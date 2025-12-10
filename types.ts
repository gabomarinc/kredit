export enum PropertyType {
  House = 'Casa',
  Apartment = 'Apartamento'
}

export interface UserPreferences {
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  zone: string[];
}

export interface FinancialData {
  familyIncome: number;
}

export interface PersonalData {
  fullName: string;
  email: string;
  phone: string;
  idFile: File | null;
  fichaFile: File | null;
  talonarioFile: File | null;
  signedAcpFile: File | null;
}

export interface CalculationResult {
  maxPropertyPrice: number;
  monthlyPayment: number;
  downPaymentPercent: number;
  downPaymentAmount: number;
}

export interface Prospect {
  id: string;
  name: string;
  email: string;
  phone?: string;
  income: number;
  date: string; // ISO string para filtros
  dateDisplay?: string; // Formato legible para mostrar
  status: 'Nuevo' | 'Contactado' | 'En Proceso';
  propertyType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  zone: string | string[]; // Puede ser string o array
  result: CalculationResult;
}