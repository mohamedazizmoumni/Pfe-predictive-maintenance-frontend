export interface Machine {
  id: number;
  serialNumber: string;
  name: string;
  description?: string;
  model: string;
  manufacturer?: string;
  location: string;
  category?: string;
  subCategory?: string;
  status?: string;
  photoUrl?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  operatingHours?: number;
  riskScore?: number;
  createdDate?: string;
}
