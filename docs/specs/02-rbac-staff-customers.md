# 02 RBAC, staff, customers
Purpose: role guards, staff management, customer records.
Roles: ADMIN full. STAFF manage customers day to day. CUSTOMER none here.
Data: Customer(name, email, phone, billingAddress, userId?, createdById, isActive), uses User from 01.
Rules:
- Helpers: requireSession(), requireRole(...roles) used inside every service function.
- Route groups: /admin/* for ADMIN and STAFF. /portal/* for CUSTOMER. Wrong role renders the /forbidden page.
  Unauthenticated requests redirect to /login with a return path.
- Only ADMIN creates staff. Admin enters name and email, the system emails a set-password link (reuses the reset token flow).
- ADMIN can deactivate staff (blocks login immediately). Cannot deactivate or demote self.
- STAFF can create, edit and list customers. A customer may exist without a portal login.
- First admin comes from the seed script only. There is no public admin signup.
Actions: createStaff, deactivateStaff, listStaff, createCustomer, updateCustomer, listCustomers (search, pagination).
UI: /admin/staff (admin only), /admin/customers with search, pagination, empty state.
Done when: STAFF calling createStaff gets 403 server-side; customer session on /admin is forbidden;
  deactivated staff can't use an existing session; customers list pages server-side.