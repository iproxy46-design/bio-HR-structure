import {pgTable,text,integer,bigint,timestamp,customType} from 'drizzle-orm/pg-core';
// Runtime DDL, including deferred foreign keys, is maintained in postgres.sql.
export const orgRevision=pgTable('org_revision',{id:integer('id').primaryKey(),revision:text('revision').notNull()});
export const units=pgTable('units',{id:text('id').primaryKey(),name:text('name').notNull(),parentId:text('parent_id'),headcount:integer('headcount'),leaderId:text('leader_id'),position:integer('position').notNull().default(0)});
export const employees=pgTable('employees',{id:text('id').primaryKey(),name:text('name').notNull(),role:text('role'),department:text('department'),unitId:text('unit_id'),location:text('location'),phone:text('phone'),email:text('email'),managerText:text('manager_text'),managerId:text('manager_id'),photoUrl:text('photo_url'),photoVersion:text('photo_version'),position:integer('position').notNull().default(0)});
const bytea=customType<{data:Buffer;driverData:Buffer}>({dataType:()=> 'bytea'});
export const employeePhotos=pgTable('employee_photos',{employeeId:text('employee_id').primaryKey(),contentType:text('content_type').notNull(),body:bytea('body').notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow()});
export const loginAttempts=pgTable('login_attempts',{ip:text('ip').primaryKey(),failures:integer('failures').notNull(),updatedAt:bigint('updated_at',{mode:'number'}).notNull(),blockedUntil:bigint('blocked_until',{mode:'number'}).notNull()});
