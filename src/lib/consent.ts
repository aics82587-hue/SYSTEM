export const CONSENT_VERSION = "2026-01";

export interface ConsentChoices {
  purpose: boolean;
  voluntary: boolean;
  identity_protection: boolean;
  publication_review: boolean;
  referral_sharing: boolean;
  public_release: boolean;
}

export const EMPTY_CONSENT_CHOICES: ConsentChoices = {
  purpose: false,
  voluntary: false,
  identity_protection: false,
  publication_review: false,
  referral_sharing: false,
  public_release: false,
};
