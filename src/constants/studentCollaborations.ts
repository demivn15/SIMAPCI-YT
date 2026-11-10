export interface StudentCollaborationRecord {
  productId: string;
  contribution: string;
}

export const STUDENT_DEMO_ID = 'demo-student-ecmc';

// The ORCID source does not identify student contributions. Do not assign demo
// participation to real publications.
export const STUDENT_COLLABORATIONS: Record<string, StudentCollaborationRecord[]> = {};
