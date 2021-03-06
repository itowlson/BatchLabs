import { Injectable } from "@angular/core";
import { StorageAccountSharedKeyOptions, StorageClientProxyFactory } from "client/api";
import { Observable } from "rxjs";

import { AutoStorageAccount, StorageKeys } from "app/models";
import { ArmResourceUtils } from "app/utils";
import { AccountService } from "./account.service";
import { ArmHttpService } from "./arm-http.service";
import { ElectronRemote } from "./electron";

export interface AutoStorageSettings {
    lastKeySync: Date;
    storageAccountId: string;
}

export interface StorageKeyCachedItem {
    batchAccountId: string;
    storageAccountName: string;
    settings: AutoStorageSettings;
    keys: StorageKeys;
}

@Injectable()
export class StorageClientService {
    public hasAutoStorage: Observable<boolean>;

    private _currentAccountId: string;
    private _currentStorageAccountId: string;
    private _storageClientFactory: StorageClientProxyFactory;
    private _storageKeyMap: StringMap<StorageKeyCachedItem> = {};

    constructor(
        private accountService: AccountService,
        private arm: ArmHttpService,
        remote: ElectronRemote) {

        this._storageClientFactory = remote.getStorageClientFactory();

        this.accountService.currentAccountId.subscribe(x => this._currentAccountId = x);
        this.hasAutoStorage = this.accountService.currentAccount.map((account) => {
            return Boolean(account.properties && account.properties.autoStorage);
        });

        this.accountService.currentAccount.subscribe((account) => {
            this._checkAndSetCachedItem(account.properties && account.properties.autoStorage);
            this._currentStorageAccountId = account.properties &&
                account.properties.autoStorage && account.properties.autoStorage.storageAccountId;
        });
    }

    public get(): Observable<any> {
        if (!this._currentAccountId) {
            throw new Error("No account currently selected ...");
        }

        return this.accountService.currentAccount.first().flatMap((account) => {
            const settings = account.properties && account.properties.autoStorage;
            const cachedItem = this._getCachedItem(settings.storageAccountId);

            // check if we have keys or if the lastKeySync date has changed
            if (cachedItem.keys && this._checkLastKeySync(cachedItem, settings)) {
                return Observable.of(this.getForSharedKey({
                    account: cachedItem.storageAccountName,
                    key: cachedItem.keys.primaryKey,
                }));
            } else {
                const url = `${settings.storageAccountId}/listkeys`;
                return this.arm.post(url, JSON.stringify({}))
                    .map(response => new StorageKeys(response.json()))
                    .cascade((keys) => {
                        cachedItem.keys = keys;
                        return Observable.of(this.getForSharedKey({
                            account: cachedItem.storageAccountName,
                            key: keys.primaryKey,
                        }));
                    });
            }
        }).share();
    }

    public getForSharedKey(options: StorageAccountSharedKeyOptions) {
        return this._storageClientFactory.getBlobServiceForSharedKey(options);
    }

    public clearCurrentStorageKeys() {
        let cachedItem = this._getCachedItem(this._currentStorageAccountId);
        if (cachedItem) {
            cachedItem.keys = null;
        }
    }

    /**
     * Get the name of the storage account from the account id
     * @param [storageAccountId] the full resource id for the storage account.
     */
    private getStorageAccountName(storageAccountId: string): string {
        const accountName = ArmResourceUtils.getAccountNameFromResourceId(storageAccountId);
        if (!accountName) {
            throw new Error(`Unable to get account name from storage account id: ${storageAccountId}`);
        }

        return accountName;
    }

    /**
     * Set up an item in the localized cache for holding onto storage keys for
     * the life of the application.
     */
    private _checkAndSetCachedItem(settings: AutoStorageAccount) {
        if (settings && !this._isCached(settings.storageAccountId)) {
            const storageAccountName = this.getStorageAccountName(settings.storageAccountId);
            this._storageKeyMap[settings.storageAccountId] = {
                batchAccountId: this._currentAccountId,
                storageAccountName: storageAccountName,
                settings: Object.assign({}, settings), // clone
                keys: null,
            };
        }
    }

    /**
     * check if settings.lastKeySync is greater than the one in the cache. If it is, return false
     * so that the keys are forced to reload.
     * @param [cachedItem] the key settings from the cache
     * @param [settings] the current account auto storage settings
     */
    private _checkLastKeySync(cachedItem: StorageKeyCachedItem, settings: AutoStorageSettings): boolean {
        if (settings.lastKeySync > cachedItem.settings.lastKeySync) {
            // update the lastKeySync value and return false so the keys are reloaded.
            this._storageKeyMap[settings.storageAccountId].settings.lastKeySync = settings.lastKeySync;
            return false;
        }

        return true;
    }

    private _isCached(storageAccountId: string): boolean {
        return Boolean(this._getCachedItem(storageAccountId));
    }

    private _getCachedItem(storageAccountId: string): StorageKeyCachedItem {
        return this._storageKeyMap[storageAccountId];
    }
}
