import { Type } from "@angular/core";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";

import { LoadingStatus } from "app/components/base/loading";
import { ServerError } from "app/models";
import { Constants, ObjectUtils, exists, log } from "app/utils";
import { DataCache } from "./data-cache";
import { PollObservable } from "./poll-service";
import { ProxyOptions } from "./proxy-options";

export interface FetchDataOptions {
    getData: () => Observable<any>;
    next: (response: any) => void;
    error?: (error: any) => void;
}

export interface RxProxyBaseConfig<TParams, TEntity> {
    /**
     *  Method that return the cache given the params.
     * This allow the use of targeted data cache which depends on some params.
     */
    cache: (params: TParams) => DataCache<TEntity>;

    initialParams?: TParams;

    /**
     * List of error code not to log in the console.
     * @default [404]
     */
    logIgnoreError?: number[];

    /**
     * Optional callback for handling any expected errors we may encounter so they
     * don't result in a debug bl-server-error component. This way we can show a custom
     * error message to the user.
     */
    onError?: (error: ServerError) => boolean;
}

/**
 * Base proxy for List and Entity proxies
 */
export abstract class RxProxyBase<TParams, TOptions extends ProxyOptions, TEntity> {
    /**
     * Status that keep track of any loading
     */
    public status: Observable<LoadingStatus>;

    /**
     * Contains the current error if any.
     */
    public error: Observable<ServerError>;

    /**
     * Push observable that send a notification if the item has been deleted.
     * Which means the item was previously loaded but returned a 404 on the last fetch.
     */
    public deleted: Observable<string>;

    /**
     * Status that is set to loading only when parameters change
     */
    public newDataStatus: Observable<LoadingStatus>;

    protected _status = new BehaviorSubject<LoadingStatus>(LoadingStatus.Loading);
    protected _newDataStatus = new BehaviorSubject<LoadingStatus>(LoadingStatus.Loading);
    protected _error = new BehaviorSubject<ServerError>(null);

    protected getCache: (params: TParams) => DataCache<TEntity>;
    protected _params: TParams;
    protected _cache: DataCache<TEntity>;
    protected _options: TOptions;
    protected _cacheCleared = new Subject<void>();

    private _currentQuerySub: Subscription = null;
    private _currentObservable: Observable<any>;
    private _deletedSub: Subscription;
    private _cacheClearedSub: Subscription;
    private _deleted = new Subject<string>();
    private _logIgnoreError: number[];
    private _pollObservable: PollObservable;

    constructor(protected type: Type<TEntity>, protected config: RxProxyBaseConfig<TParams, TEntity>) {
        this.getCache = config.cache;
        this._logIgnoreError = exists(config.logIgnoreError) ? config.logIgnoreError : [Constants.HttpCode.NotFound];
        this.status = this._status.asObservable();
        this.newDataStatus = this._newDataStatus.asObservable();
        this.error = this._error.asObservable();

        this.status.subscribe((status) => {
            if (status === LoadingStatus.Loading) {
                this._error.next(null);
            }

            // If we were loading and the last request status change to ready or error
            if (this._newDataStatus.value === LoadingStatus.Loading && status !== LoadingStatus.Loading) {
                this._newDataStatus.next(status);
            }
        });

        this.deleted = this._deleted.asObservable();
    }

    public set params(params: TParams) {
        this._params = params;
        this.cache = this.getCache(params);
        if (this._pollObservable) {

            this._pollObservable.updateKey(this._key());
        }
        this.markLoadingNewData();
        this.abortFetch();
    }

    public get params() {
        return this._params;
    }

    public setOptions(options: TOptions, clearItems = true) {
        if (this._options instanceof ProxyOptions) {
            this._options = options;
        } else {
            this._options = new ProxyOptions(options) as any;
        }
        if (this._pollObservable) {
            this._pollObservable.updateKey(this._key());
        }
        if (this.queryInProgress()) {
            this.abortFetch();
        }
    }

    public patchOptions(options: TOptions, clearItems = true) {
        this.setOptions(Object.assign({}, this._options, options), clearItems);
    }

    /**
     * @returns the current options.
     */
    public get options() {
        return this._options;
    }

    /**
     * Start refreshing the data of this RxProxy every given interval
     * You can only have ONE poll per entity.
     * @param interval {number} Interval in milliseconds.
     */
    public startPoll(interval: number): PollObservable {
        if (this._pollObservable) {
            return this._pollObservable;
        }

        this._pollObservable = this.cache.pollService.startPoll(this._key(), interval, () => {
            return this.pollRefresh();
        });
        return this._pollObservable;
    }

    /**
     * This will release any reference used by the RxProxy.
     * You NEED to call this in ngOnDestroy
     * otherwise internal subscribe will never get cleared and the list porxy will not get GC
     */
    public dispose() {
        this._clearDeleteSub();
    }

    protected set cache(cache: DataCache<TEntity>) {
        this._cache = cache;
        this._clearDeleteSub();
        this._deletedSub = cache.deleted.subscribe((x) => {
            this._deleted.next(x);
        });

        this._cacheClearedSub = cache.cleared.subscribe((x) => {
            this._cacheCleared.next(x);
        });
    }

    protected get cache() {
        return this._cache;
    }
    /**
     * Create a new item of type TEntity and adds it to the cache
     */
    protected newItem(data: any): string {
        const item = new this.type(data);
        return this.cache.addItem(item, this._options && this._options.select);
    }

    /**
     * Create a new item of type TEntity and adds it to the cache
     */
    protected newItems(data: any[]): string[] {
        const items = data.map(x => new this.type(x));
        return this.cache.addItems(items, this._options && this._options.select);
    }

    protected fetchData(options: FetchDataOptions): Observable<any> {
        if (this._currentQuerySub) {
            return this._currentObservable;
        }
        this._status.next(LoadingStatus.Loading);

        const obs = this._currentObservable = options.getData();
        this._currentQuerySub = obs.subscribe((response) => {
            options.next(response);
            this._status.next(LoadingStatus.Ready);
            this.abortFetch();
        }, (error: ServerError) => {
            // We need to clone the error otherwise it only logs the stacktrace
            // and not the actual error returned by the server which is not helpful
            if (error && error.status && !this._logIgnoreError.includes(error.status)) {
                log.error("Error in RxProxy", Object.assign({}, error));
            }

            // if we dont have a callback, or the rethrow response is true, then handle error os normal
            if (!this.config.onError || this.config.onError(error)) {
                if (options.error) {
                    options.error(error);
                }

                this._status.next(LoadingStatus.Error);
                this._error.next(error);
            } else {
                // error callback returned false so act like the error never happened
                this._status.next(LoadingStatus.Ready);
            }

            this.abortFetch();
        });

        return obs;
    }

    protected queryInProgress(): boolean {
        return this._currentQuerySub !== null;
    }

    /**
     * Abort the current request if applicable
     */
    protected abortFetch() {
        if (this._currentQuerySub) {
            this._currentQuerySub.unsubscribe();
            this._currentQuerySub = null;
        }
    }

    /**
     * Call this method when loading new data(e.g. changing the id of the entity need a new entity to be loaded)
     */
    protected markLoadingNewData() {
        this._newDataStatus.next(LoadingStatus.Loading);
    }

    protected _clearDeleteSub() {
        if (this._deletedSub) {
            this._deletedSub.unsubscribe();
        }
    }

    protected abstract pollRefresh(): Observable<any>;

    private _key() {
        const paramsKey = ObjectUtils.serialize(this._params);
        const optionsKey = ObjectUtils.serialize(this._options.original);
        return `${paramsKey}|${optionsKey}`;
    }
}
