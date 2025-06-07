// This file provides placeholder data for UI components to prevent build errors
// when the LLM hallucinates data sources.

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export const mockUsers: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', avatar: '/avatars/01.png' },
  { id: '2', name: 'Bob Williams', email: 'bob@example.com', avatar: '/avatars/02.png' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', avatar: '/avatars/03.png' },
];

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
}

export const mockProducts: Product[] = [
  { id: 'p1', name: 'Quantum Laptop', category: 'Electronics', price: 1200, image: '/products/laptop.png' },
  { id: 'p2', name: 'Acoustic Guitar', category: 'Music', price: 350, image: '/products/guitar.png' },
  { id: 'p3', name: 'Organic Coffee Beans', category: 'Groceries', price: 22, image: '/products/coffee.png' },
];

export const mockSalesData = [
  { name: 'Jan', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Feb', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Mar', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'Apr', total: Math.floor(Math.random() * 5000) + 1000 },
  { name: 'May', total: Math.floor(Math.random() * 5000) + 1000 },
];