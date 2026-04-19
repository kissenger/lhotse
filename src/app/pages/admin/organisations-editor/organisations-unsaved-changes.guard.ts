import { CanDeactivateFn } from '@angular/router';

export interface CanLeaveOrganisationsEditor {
  canLeavePage(): boolean;
}

export const organisationsUnsavedChangesGuard: CanDeactivateFn<CanLeaveOrganisationsEditor> = (component) => {
  return component.canLeavePage();
};
