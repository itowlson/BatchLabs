import { Component, Input } from "@angular/core";

import { Job, JobState } from "app/models";

@Component({
    selector: "bl-loading-button",
    template: `<button md-raised-button color="primary">
        <ng-content *ngIf="!loading"></ng-content>
        <i class="fa fa-spinner fa-spin" *ngIf="loading"></i>
    </button>`,
})
export class LoadingButtonComponent {
    @Input()
    public loading: boolean = false;
}

@Component({
    selector: "bl-clear-list-selection",
    template: `<button md-mini-fab color="accent" (click)="onClick()" md-tooltip="Clear selection">
        <i class="fa fa-check-square-o"></i>
    </button>`,
})
export class ClearListSelectionButtonComponent {
    @Input()
    public list: any;

    public onClick() {
        this.list.clearSelection();
    }
}

/**
 * Would be nice to be able to have an abstract base component that held the
 * button template and we just called super("Add", "fa-icon").
 */
@Component({
    selector: "bl-add-button",
    template: `<button md-button><i class="fa fa-plus"></i> {{title}}</button>`,
})
export class AddButtonComponent {
    @Input()
    public set title(value: string) {
        this._title = value;
    }
    public get title() {
        return this._title ? this._title : "Add";
    }

    private _title: string;
}

@Component({
    selector: "bl-add-task-button",
    template: `<button md-button [disabled]="!enabled"><i class="fa fa-plus"></i> {{title}}</button>`,
})
export class AddTaskButtonComponent {
    @Input()
    public job: Job;

    @Input()
    public set title(value: string) {
        this._title = value;
    }
    public get title() {
        return this._title ? this._title : "Add";
    }

    public get enabled() {
        return this.job
            && this.job.state !== JobState.completed
            && this.job.state !== JobState.deleting
            && this.job.state !== JobState.disabled
            && this.job.state !== JobState.disabling
            && this.job.state !== JobState.terminating;
    }

    private _title: string;
}

@Component({
    selector: "bl-terminate-button",
    template: `<button md-button [disabled]="!enabled"><i class="fa fa-times"></i> Terminate</button>`,
})
export class TerminateButtonComponent {
    @Input()
    public entity: any;

    public get enabled() {
        return this.entity
            && this.entity.state !== JobState.completed
            && this.entity.state !== JobState.terminating
            && this.entity.state !== JobState.deleting;
    }
}

@Component({
    selector: "bl-delete-button",
    template: `<button md-button [disabled]="!enabled"><i class="fa fa-trash-o"></i> Delete</button>`,
})
export class DeleteButtonComponent {
    @Input()
    public entity: any;

    public get enabled() {
        if (this.entity instanceof Job) {
            return this.entity
                && this.entity.state !== JobState.deleting
                && this.entity.state !== JobState.terminating;
        } else {
            return true;
        }
    }
}

@Component({
    selector: "bl-disable-button",
    template: `<button md-button *ngIf="visible" [disabled]="!enabled"><i class="fa fa-pause"></i> Disable</button>`,
})
export class DisableButtonComponent {
    @Input()
    public job: Job;

    public get enabled() {
        return this.job
            && this.job.state === JobState.active;
    }

    public get visible() {
        return this.job
            && this.job.state !== JobState.disabling
            && this.job.state !== JobState.disabled;
    }
}

@Component({
    selector: "bl-enable-button",
    template: `<button md-button *ngIf="visible" [disabled]="!enabled"><i class="fa fa-play"></i> Enable</button>`,
})
export class EnableButtonComponent {
    @Input()
    public job: Job;

    public get enabled() {
        return this.job && this.job.state === JobState.disabled;
    }

    public get visible() {
        return this.enabled;
    }
}

@Component({
    selector: "bl-clone-button",
    template: `<button md-button><i class="fa fa-clone"></i> {{title}}</button>`,
})
export class CloneButtonComponent {
    @Input()
    public set title(value: string) {
        this._title = value;
    }
    public get title() {
        return this._title ? this._title : "Clone";
    }

    private _title: string;
}

@Component({
    selector: "bl-download-button",
    template: `<button md-button [disabled]="!enabled"><i class="fa fa-download"></i> Download</button>`,
})
export class DownloadButtonComponent {
    @Input()
    public set enabled(value: boolean) {
        this._enabled = value;
    }
    public get enabled() {
        return this._enabled;
    }

    private _enabled: boolean;
}

@Component({
    selector: "bl-resize-button",
    template: `<button md-button><i class="fa fa-arrows-v"></i> Resize</button>`,
})
export class ResizeButtonComponent {
}

@Component({
    selector: "bl-edit-button",
    template: `<button md-button><i class="fa fa-pencil-square-o"></i> Edit</button>`,
})
export class EditButtonComponent {
}
