declare module 'recharts' {
  import type { ComponentType, ReactNode } from 'react';

  export const ResponsiveContainer: ComponentType<{ width?: string | number; height?: string | number; children: ReactNode }>;
  export const BarChart: ComponentType<{ data: unknown[]; margin?: Record<string, number>; children: ReactNode }>;
  export const Bar: ComponentType<{ dataKey: string; fill?: string; radius?: number[] }>;
  export const XAxis: ComponentType<{ dataKey: string; tick?: Record<string, unknown> }>;
  export const YAxis: ComponentType<{ tick?: Record<string, unknown> }>;
  export const CartesianGrid: ComponentType<{ strokeDasharray?: string; stroke?: string }>;
  export const Tooltip: ComponentType<{ contentStyle?: Record<string, unknown>; formatter?: (value: number, name: string) => [string, string] }>;
  export const Legend: ComponentType;
  export const PieChart: ComponentType<{ children: ReactNode }>;
  export const Pie: ComponentType<{ data: unknown[]; cx?: string; cy?: string; innerRadius?: number; outerRadius?: number; paddingAngle?: number; dataKey: string; label?: unknown; children: ReactNode }>;
  export const Cell: ComponentType<{ key?: string; fill?: string }>;
  export const LineChart: ComponentType<{ data: unknown[]; margin?: Record<string, number>; children: ReactNode }>;
  export const Line: ComponentType<{ type?: string; dataKey: string; stroke?: string; strokeWidth?: number; dot?: Record<string, unknown> }>;
}

declare module '@react-pdf/renderer' {
  import type { ComponentType, ReactNode } from 'react';

  export const Document: ComponentType<{ children: ReactNode }>;
  export const Page: ComponentType<{ size?: string; style?: Record<string, unknown> | Record<string, unknown>[]; children: ReactNode }>;
  export const View: ComponentType<{ style?: Record<string, unknown> | Record<string, unknown>[]; children?: ReactNode }>;
  export const Text: ComponentType<{ style?: Record<string, unknown> | Record<string, unknown>[]; children?: ReactNode }>;
  export const StyleSheet: { create: <T extends Record<string, Record<string, unknown>>>(styles: T) => T };
  export const PDFDownloadLink: ComponentType<{ document: ReactNode; fileName?: string; className?: string; children: (props: { loading: boolean }) => ReactNode }>;
  export const PDFViewer: ComponentType<{ width?: number | string; height?: number | string; showToolbar?: boolean; children: ReactNode }>;
}
