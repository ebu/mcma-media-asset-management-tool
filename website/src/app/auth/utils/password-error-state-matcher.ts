import { ErrorStateMatcher } from "@angular/material/core";
import { UntypedFormControl, FormGroupDirective, NgForm } from "@angular/forms";

export class PasswordErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: UntypedFormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const invalidCtrl = !!(control?.invalid && control?.parent?.dirty);
    const invalidParent = !!(control?.parent?.invalid && control?.parent?.dirty);

    return invalidCtrl || invalidParent;
  }
}
