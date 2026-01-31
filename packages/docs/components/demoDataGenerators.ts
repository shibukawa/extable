import { defineSchema } from "@extable/core"
import type { Schema, View } from "@extable/core";

/**
 * Common data generators and schemas for demo components
 */

export interface DemoEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  joinDate: string;
  role?: "manager" | "engineer" | "designer" | "analyst";
  salary?: number;
  active?: boolean;
  status?: "pending" | "approved" | "rejected";
}

/**
 * Common schema for employee-based demos
 */
export const employeeSchema = defineSchema<DemoEmployee>({
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "email", header: "Email", type: "string", width: 200 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "joinDate",
      header: "Join Date",
      type: "date",
      width: 120,
      style: { align: "center" },
    },
    {
      key: "role",
        header: "Role",
        type: "enum",
        enum: ["manager", "engineer", "designer", "analyst"],
        width: 130,
    },
    {
      key: "active",
      header: "Active",
      type: "boolean",
      format: "checkbox",
      width: 100,
    },
  ],
});

/**
 * Common schema for readonly mode demo
 */
export const readonlyEmployeeSchema = defineSchema<DemoEmployee>({
  columns: [
    { key: "id", header: "ID", type: "string", width: 100 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "email", header: "Email", type: "string", width: 200 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "joinDate",
      header: "Join Date",
      type: "date",
      width: 120,
      style: { align: "center" },
    },
    {
      key: "salary",
      header: "Salary",
      type: "number",
      format: { precision: 10, scale: 0 },
      width: 180,
      style: { align: "right" },
    },
    {
      key: "active",
      header: "Active",
      type: "boolean",
      format: "checkbox",
      width: 100,
    },
  ],
});

/**
 * Common schema for commit mode demo
 */
export const commitEmployeeSchema = defineSchema<DemoEmployee>({
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 100 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "email", header: "Email", type: "string", width: 180 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "role",
        header: "Role",
        type: "enum",
        enum: ["manager", "engineer", "designer", "analyst"],
        width: 140,
    },
    {
      key: "salary",
      header: "Salary",
      type: "number",
      format: { precision: 10, scale: 0 },
      width: 120,
      style: { align: "right" },
    },
    {
      key: "status",
        header: "Status",
        type: "enum",
        enum: ["pending", "approved", "rejected"],
        readonly: true,
        width: 120,
    },
  ],
});

/**
 * Common view for all employee demos
 */
export const defaultEmployeeView = {
  hiddenColumns: [],
  filters: [],
  sorts: [],
} satisfies View;

/**
 * Generate employee data for demos
 * @param count Number of employees to generate
 * @param includeExtra Whether to include optional fields like salary and status
 */
export function generateEmployeeData(count: number, includeExtra = false): DemoEmployee[] {
  const roles: Array<"manager" | "engineer" | "designer" | "analyst"> = [
    "manager",
    "engineer",
    "designer",
    "analyst",
  ];
  const departments = ["Engineering", "Design", "Product", "Sales", "Operations", "HR"];
  const statuses: Array<"pending" | "approved" | "rejected"> = ["pending", "approved", "rejected"];
  const rows: DemoEmployee[] = [];

  for (let i = 1; i <= count; i++) {
    const joinYear = 2020 + Math.floor(i / 20);
    const joinMonth = String((i % 12) + 1).padStart(2, "0");
    const joinDay = String((i % 28) + 1).padStart(2, "0");

    const employee: DemoEmployee = {
      id: `EMP-${String(i).padStart(5, "0")}`,
      name: `Employee ${i}`,
      email: `emp${i}@company.com`,
      department: departments[i % departments.length],
      joinDate: `${joinYear}-${joinMonth}-${joinDay}`,
      role: roles[i % roles.length],
      active: i % 7 !== 0,
    };

    if (includeExtra) {
      employee.salary = 50000 + i * 1000 + Math.floor(Math.random() * 50000);
      employee.status = statuses[i % statuses.length];
    }

    rows.push(employee);
  }

  return rows;
}

/**
 * Generate employee data with status for commit mode
 */
export function generateEmployeeWithStatusData(count: number): DemoEmployee[] {
  return generateEmployeeData(count, true);
}
