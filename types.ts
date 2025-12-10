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
  income: number;
  date: string;
  status: 'Nuevo' | 'Contactado' | 'En Proceso';
  zone: string;
  result: CalculationResult;
}