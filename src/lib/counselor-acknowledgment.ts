export const COUNSELOR_ACKNOWLEDGMENT_VERSION = "2026-01";

export const COUNSELOR_RESPONSIBILITIES = [
  {
    key: "safe_space",
    label: "I will provide a safe, respectful and non-judgmental space for students seeking support.",
  },
  {
    key: "confidentiality",
    label: "I will keep student information confidential. Pen names are used for students, and I will not disclose or try to identify them without proper cause.",
  },
  {
    key: "voluntary_participation",
    label: "I will respect that students' participation is voluntary, and they may decline any question or withdraw at any time.",
  },
  {
    key: "referral_transparency",
    label: "I will only refer a student to another service or person when it is helpful, and I will explain to the student what information is shared and with whom.",
  },
  {
    key: "story_publication",
    label: "I will secure separate consent from the student before any story or interview is shared on the official SSC platform.",
  },
  {
    key: "timely_response",
    label: "I will respond to students' concerns and referrals in a timely and professional manner.",
  },
] as const;

export type CounselorResponsibilityKey =
  (typeof COUNSELOR_RESPONSIBILITIES)[number]["key"];

export type CounselorAcknowledgmentStatements = Record<
  CounselorResponsibilityKey,
  boolean
>;

export const EMPTY_COUNSELOR_ACKNOWLEDGMENT: CounselorAcknowledgmentStatements = {
  safe_space: false,
  confidentiality: false,
  voluntary_participation: false,
  referral_transparency: false,
  story_publication: false,
  timely_response: false,
};

export function isCompleteCounselorAcknowledgment(
  value: unknown,
): value is CounselorAcknowledgmentStatements {
  if (!value || typeof value !== "object") return false;
  const statements = value as Record<string, unknown>;
  return COUNSELOR_RESPONSIBILITIES.every(
    ({ key }) => statements[key] === true,
  );
}
