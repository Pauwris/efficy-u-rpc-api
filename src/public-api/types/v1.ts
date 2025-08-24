export interface DocumentFile {
  /**
   * CRM id of the object
   * @example "00010QH200001PKZ"
   */
  crm_id: string;
  /**
   * The name of the file, including its extension.
   * @example "important.pdf"
   */
  name: string;
  /**
   * A comment or note associated with the file.
   * @example "This file is an important document"
   */
  comment: string;
  /**
   * A Base64-encoded reference to the file stream used for uploading or linking the document.
   * @example "LS0tCm9wZW5hcGk6ICIzLjAuMCIKaW5mbzoKICB0aXRsZTogImVmZmljeVUgcHVibGljQVBJIgogIHZlcnNpb246ICIxLjAuMCIKICBkZXNjcmlwdGlvbjogIkEgUHV="
   */
  stream: string;
  /**
   * Creation date
   * @example "2024-11-14T13:31:40.033Z"
   */
  creation_date: string;
  /**
   * Date of the last modfication
   * @example "2024-11-18T13:31:40.033Z"
   */
  last_update_date: string;
  /**
   * User code of the user who last modified the object
   * @example "JODOE"
   */
  last_updated_by: string;
}

export interface DocumentFiles {
  /**
   * Number of records returned
   * @example 20
   */
  records_found: number;
  /**
   * Next page of records
   * @example "/api/v1/documents/{id}/files?offset=40&limit=20"
   */
  next?: string;
  /**
   * Previous page of records
   * @example "/api/v1/documents/{id}/files?offset=0&limit=20"
   */
  previous?: string;
  /**
   * List of document files
   */
  data: DocumentFile[];
}