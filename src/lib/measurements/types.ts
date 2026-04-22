export interface MemberMeasurementRecord {
  id: string;
  member_id: string;
  recorded_by?: string | null;
  recorded_at: string;
  created_at?: string;
  updated_at?: string;
  notes?: string | null;
  photos?: string[] | null;
  signedPhotoUrls?: string[];
  front_progress_photo_path?: string | null;
  side_progress_photo_path?: string | null;
  frontProgressPhotoUrl?: string | null;
  sideProgressPhotoUrl?: string | null;
  gender_presentation?: 'male' | 'female' | 'other' | null;
  posture_type?: string | null;
  body_shape_profile?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  body_fat_percentage?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  biceps_left_cm?: number | null;
  biceps_right_cm?: number | null;
  thighs_left_cm?: number | null;
  thighs_right_cm?: number | null;
  calves_cm?: number | null;
  shoulder_cm?: number | null;
  neck_cm?: number | null;
  forearm_left_cm?: number | null;
  forearm_right_cm?: number | null;
  wrist_left_cm?: number | null;
  wrist_right_cm?: number | null;
  ankle_left_cm?: number | null;
  ankle_right_cm?: number | null;
  inseam_cm?: number | null;
  torso_length_cm?: number | null;
  abdomen_cm?: number | null;
  recorded_by_profile?: {
    full_name?: string | null;
  } | null;
}

export type MeasurementNumericField = Exclude<
  keyof MemberMeasurementRecord,
  | 'id'
  | 'member_id'
  | 'recorded_by'
  | 'recorded_at'
  | 'created_at'
  | 'updated_at'
  | 'notes'
  | 'photos'
  | 'signedPhotoUrls'
  | 'front_progress_photo_path'
  | 'side_progress_photo_path'
  | 'frontProgressPhotoUrl'
  | 'sideProgressPhotoUrl'
  | 'gender_presentation'
  | 'posture_type'
  | 'body_shape_profile'
  | 'recorded_by_profile'
>;
