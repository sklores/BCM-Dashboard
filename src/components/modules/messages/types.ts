export type Message = {
  id: string;
  project_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  received_at: string;
};
