import { Component, DebugElement, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { List } from "immutable";
import { BehaviorSubject } from "rxjs";

import { SSHKeyPickerComponent } from "app/components/node/connect";
import { SSHPublicKey } from "app/models";
import { SSHKeyService } from "app/services";
import { click } from "test/utils/helpers";

@Component({
    template: `<bl-ssh-key-picker [(ngModel)]="sshValue"></bl-ssh-key-picker>`,
})
class TestComponent {
    public sshValue: string;
}

describe("SSHKeyPickerComponent", () => {
    let fixture: ComponentFixture<TestComponent>;
    let testComponent: TestComponent;
    let component: SSHKeyPickerComponent;
    let de: DebugElement;
    let sshKeyServiceSpy;
    let saveKeyForm: DebugElement;

    beforeEach(() => {
        sshKeyServiceSpy = {
            keys: new BehaviorSubject<List<SSHPublicKey>>(List([])),
            saveKey: jasmine.createSpy("saveKey"),
            deleteKey: jasmine.createSpy("deleteKey"),
        };
        TestBed.configureTestingModule({
            imports: [],
            declarations: [SSHKeyPickerComponent, TestComponent],
            providers: [
                { provide: SSHKeyService, useValue: sshKeyServiceSpy },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        });
        fixture = TestBed.createComponent(TestComponent);
        testComponent = fixture.componentInstance;
        de = fixture.debugElement.query(By.css("bl-ssh-key-picker"));
        component = de.componentInstance;
        saveKeyForm = de.query(By.css(".save-key-form"));
        fixture.detectChanges();
    });

    it("it should show no key message when no saved keys", () => {
        expect(de.nativeElement.textContent).toContain("No saved public keys");
    });

    it("it not show the save key form by default", () => {
        expect(saveKeyForm).toBeHidden();
    });

    it("click on save should open form for name", () => {
        const btn = de.query(By.css(".add-key-btn"));
        expect(btn).not.toBeFalsy();

        click(btn);
        fixture.detectChanges();
        expect(saveKeyForm).toBeVisible();

        const saveBtn = de.query(By.css(".save-key-btn"));
        click(saveBtn);
        fixture.detectChanges();
        expect(saveKeyForm).toBeHidden();
        expect(sshKeyServiceSpy.saveKey).toHaveBeenCalledOnce();
    });

    describe("when there is some saved keys", () => {
        beforeEach(() => {
            sshKeyServiceSpy.keys.next(List([
                new SSHPublicKey({ name: "Key 1", value: "some-key-1" }),
                new SSHPublicKey({ name: "Key 2", value: "some-key-2" }),
            ]));
            fixture.detectChanges();
        });

        it("it should NOT show no key message when no saved keys", () => {
            expect(de.nativeElement.textContent).not.toContain("No saved public keys");
        });

        it("it should show all key labels", () => {
            const keys = de.queryAll(By.css(".key"));
            expect(keys.length).toBe(2);
            expect(keys[0].nativeElement.textContent).toContain("Key 1");
            expect(keys[1].nativeElement.textContent).toContain("Key 2");
        });

        it("click on the delete button should removed the saved key", () => {
            const keys = de.queryAll(By.css(".key"));
            click(keys[0].query(By.css(".fa-times")));
            fixture.detectChanges();
            expect(sshKeyServiceSpy.deleteKey).toHaveBeenCalledOnce();
        });

        it("click on key should update the ssh value", () => {
            const keys = de.queryAll(By.css(".key"));
            click(keys[0]);
            fixture.detectChanges();
            expect(component.sshKeyValue.value).toEqual("some-key-1");
        });
    });
});
