import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from "@angular/core";
import { autobind } from "core-decorators";

import { AccountResource, Application } from "app/models";
import { AccountService, ElectronShell } from "app/services";
import { ExternalLinks } from "app/utils/constants";

@Component({
    selector: "bl-application-error-display",
    templateUrl: "application-error-display.html",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationErrorDisplayComponent implements OnInit {
    @Input()
    public application: Application;

    public get batchAccount() {
        return this._batchAccount;
    }

    private _batchAccount: AccountResource;

    constructor(
        private accountService: AccountService,
        private changeDetector: ChangeDetectorRef,
        private shell: ElectronShell) {
    }

    public get hasLinkedStorageAccountIssue(): boolean {
        if (this._batchAccount) {
            return !this._batchAccount.properties
                || !this._batchAccount.properties.autoStorage
                || !this._batchAccount.properties.autoStorage.storageAccountId;
        }

        return false;
    }

    public ngOnInit() {
        this.accountService.currentAccount.subscribe((account) => {
            this._batchAccount = account;
            this.changeDetector.markForCheck();
        });
    }

    @autobind()
    public setupLinkedStorage() {
        this.shell.openExternal(ExternalLinks.setupStorageAccount.format(this._batchAccount.id));
    }
}
