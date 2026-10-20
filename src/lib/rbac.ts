/**
 * Role-Based Access Control
 * Three primary roles: super_admin, hospital_owner, patient
 * Additional: staff, doctor
 */

export type Role = "super_admin" | "hospital_owner" | "patient" | "staff" | "doctor";

export const ROLES: Record<Role, { label: string; level: number }> = {
  super_admin: { label: "Super Admin", level: 100 },
  hospital_owner: { label: "Hospital Owner", level: 50 },
  doctor: { label: "Doctor", level: 40 },
  staff: { label: "Staff", level: 30 },
  patient: { label: "Patient", level: 10 },
};

export const PERMISSIONS = {
  // Super Admin only
  MANAGE_ALL_HOSPITALS: ["super_admin"],
  MANAGE_ALL_USERS: ["super_admin"],
  MANAGE_SYSTEM_CONFIG: ["super_admin"],
  MANAGE_DRIVE_CONFIG: ["super_admin"],
  VIEW_ALL_ANALYTICS: ["super_admin"],
  MANAGE_HOSPITAL_OWNER: ["super_admin"],

  // Hospital Owner + Super Admin
  MANAGE_OWN_HOSPITAL: ["super_admin", "hospital_owner"],
  MANAGE_DOCTORS: ["super_admin", "hospital_owner"],
  MANAGE_DEPARTMENTS: ["super_admin", "hospital_owner"],
  MANAGE_GALLERY: ["super_admin", "hospital_owner"],
  MANAGE_SCHEDULES: ["super_admin", "hospital_owner"],
  VIEW_HOSPITAL_APPOINTMENTS: ["super_admin", "hospital_owner", "staff", "doctor"],
  MANAGE_BILLING: ["super_admin", "hospital_owner", "staff"],
  VIEW_HOSPITAL_ANALYTICS: ["super_admin", "hospital_owner"],
  MANAGE_STAFF: ["super_admin", "hospital_owner"],
  EXPORT_REPORTS: ["super_admin", "hospital_owner"],

  // All authenticated
  VIEW_OWN_APPOINTMENTS: ["super_admin", "hospital_owner", "patient", "staff", "doctor"],
  BOOK_APPOINTMENT: ["super_admin", "hospital_owner", "patient", "staff", "doctor"],
  VIEW_GALLERY: ["super_admin", "hospital_owner", "patient", "staff", "doctor"],
  VIEW_DOCTORS: ["super_admin", "hospital_owner", "patient", "staff", "doctor"],

  // Admin operations (hospital_owner + super_admin)
  CANCEL_ANY_APPOINTMENT: ["super_admin", "hospital_owner", "staff"],
  UPDATE_APPOINTMENT_STATUS: ["super_admin", "hospital_owner", "staff", "doctor"],
} as const;

export function hasPermission(role: string, permission: keyof typeof PERMISSIONS): boolean {
  const allowed = PERMISSIONS[permission];
  return (allowed as readonly string[]).includes(role);
}

export function hasRole(userRole: string, requiredRole: Role): boolean {
  const userLevel = ROLES[userRole as Role]?.level ?? 0;
  const requiredLevel = ROLES[requiredRole]?.level ?? 0;
  return userLevel >= requiredLevel;
}

export function canAccessHospital(userRole: string, userHospitalId: string | null, targetHospitalId: string | null): boolean {
  if (userRole === "super_admin") return true;
  if (!userHospitalId || !targetHospitalId) return false;
  return userHospitalId === targetHospitalId;
}

export function isAdminRole(role: string): boolean {
  return role === "super_admin" || role === "hospital_owner";
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}
