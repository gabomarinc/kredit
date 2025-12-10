import { Prospect } from './types';

export const ZONES_PANAMA = [
  "San Francisco",
  "Costa del Este",
  "Bella Vista",
  "El Cangrejo",
  "Obarrio",
  "Punta Pacífica",
  "Clayton",
  "Albrook",
  "Condado del Rey",
  "Santa María"
];

// Based on the user provided table
export const INCOME_BRACKETS = [
  { min: 0, max: 3299, price: 0, monthly: 0, down: 0 }, // Fallback for low income
  { min: 3000, max: 3300, price: 190000, monthly: 1080, down: 0.10 },
  { min: 3301, max: 3500, price: 220000, monthly: 1240, down: 0.10 },
  { min: 3501, max: 4000, price: 250000, monthly: 1420, down: 0.10 },
  { min: 4001, max: 4500, price: 280000, monthly: 1592, down: 0.10 },
  { min: 4501, max: 5000, price: 300000, monthly: 1700, down: 0.10 },
  { min: 5001, max: 5500, price: 350000, monthly: 1950, down: 0.10 },
  { min: 5501, max: 6200, price: 380000, monthly: 2161, down: 0.10 },
  { min: 6201, max: 6800, price: 420000, monthly: 2365, down: 0.10 },
  { min: 6801, max: 7500, price: 450000, monthly: 2560, down: 0.10 },
  { min: 7501, max: 8500, price: 500000, monthly: 2844, down: 0.10 },
  { min: 8501, max: 10000, price: 600000, monthly: 3050, down: 0.20 },
  { min: 10001, max: 11500, price: 800000, monthly: 3600, down: 0.30 },
  { min: 11501, max: 99999, price: 900000, monthly: 4000, down: 0.30 },
];

export const MOCK_PROSPECTS: Prospect[] = [
  {
    id: '1',
    name: 'Roberto Méndez',
    email: 'roberto.m@gmail.com',
    income: 3400,
    date: '2023-10-24',
    status: 'Nuevo',
    zone: 'San Francisco',
    result: { maxPropertyPrice: 220000, monthlyPayment: 1240, downPaymentPercent: 0.10, downPaymentAmount: 22000 }
  },
  {
    id: '2',
    name: 'Ana Castillo',
    email: 'ana.castillo@outlook.com',
    income: 5400,
    date: '2023-10-23',
    status: 'En Proceso',
    zone: 'Costa del Este',
    result: { maxPropertyPrice: 350000, monthlyPayment: 1950, downPaymentPercent: 0.10, downPaymentAmount: 35000 }
  },
  {
    id: '3',
    name: 'Carlos y Sofia Ruiz',
    email: 'familia.ruiz@yahoo.com',
    income: 8200,
    date: '2023-10-22',
    status: 'Contactado',
    zone: 'Bella Vista',
    result: { maxPropertyPrice: 500000, monthlyPayment: 2844, downPaymentPercent: 0.10, downPaymentAmount: 50000 }
  },
  {
    id: '4',
    name: 'David King',
    email: 'dking@tech.pa',
    income: 12500,
    date: '2023-10-21',
    status: 'Nuevo',
    zone: 'Santa María',
    result: { maxPropertyPrice: 900000, monthlyPayment: 4000, downPaymentPercent: 0.30, downPaymentAmount: 270000 }
  },
  {
    id: '5',
    name: 'Elena Torres',
    email: 'elena.t@gmail.com',
    income: 4100,
    date: '2023-10-20',
    status: 'Contactado',
    zone: 'El Cangrejo',
    result: { maxPropertyPrice: 280000, monthlyPayment: 1592, downPaymentPercent: 0.10, downPaymentAmount: 28000 }
  },
  {
    id: '6',
    name: 'Marcos y Julia',
    email: 'mj.couple@hotmail.com',
    income: 6500,
    date: '2023-10-19',
    status: 'En Proceso',
    zone: 'Costa del Este',
    result: { maxPropertyPrice: 420000, monthlyPayment: 2365, downPaymentPercent: 0.10, downPaymentAmount: 42000 }
  },
  {
    id: '7',
    name: 'Patricia Wong',
    email: 'patty.wong@empresa.com',
    income: 9200,
    date: '2023-10-18',
    status: 'Nuevo',
    zone: 'San Francisco',
    result: { maxPropertyPrice: 600000, monthlyPayment: 3050, downPaymentPercent: 0.20, downPaymentAmount: 120000 }
  }
];