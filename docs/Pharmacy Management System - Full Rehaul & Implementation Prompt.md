# PHARMACY MANAGEMENT SYSTEM — FULL-SCALE PROTOTYPE REHAUL

You are working on an existing pharmacy management system project.

Your task is to **completely rehaul the existing system into a functional, realistic Pharmacy Management System**, not merely redesign the UI.

The final result must prioritize:

1. **Functionality**
2. **Correctness**
3. **Data integrity**
4. **Security**
5. **Usability / HCI**
6. **Maintainability**
7. **Modern but simple pharmacy-appropriate design**

Do NOT produce an AI-looking template, generic dashboard, fake functionality, placeholder buttons, or disconnected frontend screens.

The system must actually work end-to-end.

\---

# 1\. FIRST: INSPECT THE EXISTING PROJECT

Before changing anything:

* Inspect the entire existing project structure.
* Identify the frontend framework.
* Identify the backend framework, if one exists.
* Identify the current database implementation.
* Identify existing routes/pages/components.
* Identify existing authentication.
* Identify existing API endpoints.
* Identify existing models/schema.
* Identify reusable components.
* Identify functionality that already works.
* Identify broken, duplicated, or unnecessary code.
* Identify the current package manager.
* Identify the current environment configuration.

Do NOT blindly replace the project.

Preserve useful existing functionality where appropriate, but restructure it when necessary.

Before implementation, determine:

* What can be reused
* What must be rewritten
* What must be added
* What dependencies are missing

Then install all necessary dependencies.

\---

# 2\. TECHNOLOGY REQUIREMENTS

The system must use:

## Database

**PostgreSQL**

The application must use PostgreSQL as the actual persistent database.

Do NOT use:

* localStorage as the primary database
* mock JSON files
* hardcoded arrays
* fake database APIs
* frontend-only CRUD

All important data must persist in PostgreSQL.

Use a proper ORM/database layer such as:

* Prisma
* Drizzle
* or another appropriate PostgreSQL ORM

Choose the option that best fits the existing project.

\---

# 3\. DATABASE DESIGN

Create a proper relational database.

At minimum, implement appropriate tables/models for:

### Users

Fields should include appropriate values such as:

* id
* username
* password\_hash
* full\_name
* role
* email
* status
* created\_at
* updated\_at
* last\_login

Roles:

* ADMIN
* CASHIER
* PHARMACIST

Passwords must NEVER be stored as plaintext.

Use secure password hashing.

\---

### Medicines

Include fields such as:

* medicine\_id
* barcode
* generic\_name
* brand\_name
* medicine\_type
* dosage\_form
* strength
* prescription\_required
* description
* dosage\_information
* precautions
* contraindications
* storage\_information
* supplier\_id
* unit\_price
* quantity
* reorder\_level
* expiration\_date
* batch\_number
* created\_at
* updated\_at

Do not expose medical information as authoritative medical advice.

Dosage and precaution information should be presented as **reference information**, with appropriate wording indicating that professional guidance should be followed.

\---

### Suppliers

Include:

* supplier\_id
* supplier\_name
* contact\_person
* phone
* email
* address
* status
* created\_at
* updated\_at

\---

### Purchases / Supplier Orders

Track:

* purchase\_id
* supplier\_id
* purchase\_date
* reference\_number
* total\_amount
* status
* created\_by

\---

### Purchase Items

Track:

* purchase\_item\_id
* purchase\_id
* medicine\_id
* quantity
* unit\_cost
* subtotal
* batch\_number
* expiration\_date

\---

### Sales / Transactions

Track:

* sale\_id
* cashier\_id
* transaction\_date
* subtotal
* discount
* tax
* total\_amount
* payment\_method
* amount\_received
* change\_amount
* status

\---

### Sale Items

Track:

* sale\_item\_id
* sale\_id
* medicine\_id
* quantity
* unit\_price
* subtotal

\---

### Inventory Transactions

Track every meaningful stock movement:

* inventory\_transaction\_id
* medicine\_id
* transaction\_type
* quantity
* previous\_quantity
* resulting\_quantity
* reference\_id
* performed\_by
* timestamp
* notes

Transaction types may include:

* PURCHASE
* SALE
* RETURN
* ADJUSTMENT
* EXPIRED
* DAMAGED

\---

### Audit Logs

Create a proper audit logging system.

Track:

* log\_id
* user\_id
* action
* entity\_type
* entity\_id
* timestamp
* IP address where appropriate
* relevant metadata
* success/failure

Examples:

* LOGIN
* LOGOUT
* CREATE\_MEDICINE
* UPDATE\_MEDICINE
* DELETE\_MEDICINE
* CREATE\_SUPPLIER
* UPDATE\_SUPPLIER
* DELETE\_SUPPLIER
* CREATE\_USER
* UPDATE\_USER
* DELETE\_USER
* SALE\_COMPLETED
* INVENTORY\_ADJUSTED
* BACKUP\_CREATED
* FAILED\_LOGIN

Audit logs must not be casually editable or deletable by ordinary users.

\---

# 4\. COMPLETE CRUD FUNCTIONALITY

CRUD must be REAL.

Implement:

## Create

Users must be able to create appropriate records according to their role.

## Read

Users must be able to view database records.

## Update

Authorized users must be able to modify records.

## Delete

Authorized users must be able to delete records where appropriate.

However, do NOT allow destructive deletion where it would compromise financial, inventory, or audit integrity.

For important historical records, prefer:

* soft deletion
* archival
* status changes

instead of permanently deleting them.

Every CRUD operation must:

1. Validate input
2. Check authentication
3. Check authorization
4. Perform the database operation
5. Record an audit log where appropriate
6. Return a meaningful success/error response

\---

# 5\. ROLE-BASED ACCESS CONTROL

Implement actual RBAC.

## ADMIN

Admin should be able to:

* manage users
* manage medicines
* manage suppliers
* manage inventory
* view sales
* view reports
* view audit logs
* manage system settings
* perform/trigger database backups where appropriate
* manage roles and account status
* access POS, inventory, and reports

\---

## PHARMACIST

Pharmacist should be able to:

* search medicines
* view medicine information
* view dosage/reference information
* view precautions
* verify prescription-related information where applicable
* manage inventory where authorized
* add/update medicine information/stock where appropriate
* review sales
* review stock levels
* view relevant reports

Pharmacists should NOT automatically have unrestricted administrative access and access to POS.

\---

## CASHIER

Cashier should be able to:

* log in
* search medicines
* scan medicine barcodes
* add products to cart
* modify cart quantities
* see but not edit inventory
* process sales
* calculate totals
* accept payment
* calculate change
* print/generate receipts
* view appropriate transaction history

Cashiers should NOT be able to:

* manage users
* view reports
* change permissions
* access sensitive system administration
* arbitrarily modify inventory
* delete audit logs
* modify historical transactions

\---

# 6\. LOGIN / AUTHENTICATION

Create a proper login system.

Login must include:

* username/email
* password
* validation
* authentication
* session management
* logout
* failed login handling
* account status checking
* role identification

Implement secure authentication.

Passwords must be hashed.

Do not place passwords in:

* frontend code
* localStorage
* logs
* API responses
* database plaintext fields

Implement appropriate session/token security based on the application's architecture.

\---

# 7\. BARCODE SCANNER

Implement a functional barcode-scanning workflow.

The pharmacy must be able to scan a medicine barcode using:

* device camera where supported
* USB barcode scanner where supported

A USB barcode scanner should work like keyboard input.

When a barcode is scanned:

1. Read barcode.
2. Search PostgreSQL.
3. Find matching medicine.
4. Display medicine information.
5. Display current stock.
6. Display price.
7. Add it to the transaction/cart where appropriate.

If no medicine matches:

Display a clear message:

"Medicine not found."

Do NOT silently fail.

\---

# 8\. MEDICINE SEARCH AND FILTERING

Create a fast medicine search system.

Search by:

* generic name
* brand name
* barcode
* medicine type
* dosage form
* strength
* supplier
* batch number

Filters:

* prescription required
* in stock
* low stock
* out of stock
* expired
* expiring soon
* medicine type
* supplier

Allow sorting by:

* name
* price
* stock
* expiration date
* recently updated

Search should be debounced and efficient.

Do not load thousands of records unnecessarily if server-side filtering/pagination is appropriate.

\---

# 9\. MEDICINE INFORMATION

When a medicine is selected, show a concise information panel.

Include:

* Generic name
* Brand name
* Strength
* Dosage form
* Medicine type
* Prescription requirement
* Stock
* Price
* Supplier
* Batch number
* Expiration date
* Dosage/reference information
* Precautions
* Contraindications
* Storage instructions

The UI should clearly distinguish:

**SYSTEM REFERENCE INFORMATION**

from actual professional medical advice.

Do not invent medical information.

Seed the database only with accurate, appropriate sample/reference data.

\---

# 10\. POINT OF SALE

Create a proper pharmacy POS.

Workflow:

1. Cashier logs in.
2. Cashier searches/scans medicine.
3. Medicine is added to cart.
4. Quantity can be changed.
5. Stock availability is checked.
6. Subtotal is calculated.
7. Applicable discount/tax logic is calculated.
8. Total is displayed.
9. Payment method is selected.
10. Amount received is entered.
11. Change is calculated.
12. Transaction is confirmed.
13. Inventory is reduced.
14. Sale is stored in PostgreSQL.
15. Audit log is created.
16. Receipt is generated.

Use database transactions so that inventory and sales cannot become inconsistent.

Example:

If the sale succeeds:

Sale record + sale items + inventory reduction + audit log

must be handled safely.

If something fails, prevent partial transactions.

\---

# 11\. RECEIPT SYSTEM

Create a professional pharmacy receipt.

Receipt should include:

* Pharmacy name
* Pharmacy address
* Contact information
* Transaction number
* Date/time
* Cashier
* Medicine name
* Quantity
* Unit price
* Subtotal
* Discount
* Tax where applicable
* Total
* Payment method
* Amount received
* Change
* Prescription-related notice where appropriate
* Return/refund policy where appropriate

Make the receipt printable.

Support:

* thermal receipt style
* standard print layout
* print preview

Do NOT make it look like a generic ecommerce receipt.

It should look like a real pharmacy POS receipt.

\---

# 12\. INVENTORY MANAGEMENT

Implement proper inventory functionality.

Show:

* current stock
* low-stock medicines
* out-of-stock medicines
* expired medicines
* medicines expiring soon
* batch information
* supplier
* stock movement

Allow authorized users to:

* receive stock
* adjust stock
* record damaged items
* record expired items
* process returns where appropriate

Every inventory adjustment must be logged.

\---

# 13\. SUPPLIER MANAGEMENT

Create supplier CRUD.

Allow authorized users to:

* add supplier
* edit supplier
* deactivate supplier
* view supplier
* search supplier
* view supplied medicines
* record purchase orders/receiving

Supplier barcode functionality should allow receiving inventory through scanning where appropriate.

Example workflow:

Scan supplier/product barcode → identify medicine → enter received quantity → batch → expiration → cost → save → inventory updated.

\---

# 14\. DATABASE BACKUP

Implement a practical backup system.

The application should provide an administrative backup function.

Requirements:

* PostgreSQL backup support
* backup timestamp
* backup status
* backup metadata
* backup history

If direct database backup cannot safely be performed from the browser, create a secure backend/admin operation.

Do NOT pretend that a frontend "Backup Database" button actually backs up PostgreSQL.

It must perform a real backup operation or clearly state the configured backup mechanism.

Do not expose database credentials to the frontend.

\---

# 15\. AUDIT LOGS

Create an administrator audit-log interface.

Allow authorized administrators to filter by:

* user
* action
* date
* entity
* success/failure

Display:

* timestamp
* user
* action
* affected entity
* result

Audit logs should be difficult to tamper with.

Do not allow ordinary users to delete or edit audit records.

\---

# 16\. REPORTS / DASHBOARD

Create useful operational dashboards.

Do NOT create meaningless charts just to make the system look impressive.

Useful metrics:

* Today's sales
* Number of transactions
* Current inventory value
* Low-stock medicines
* Expiring medicines
* Out-of-stock medicines
* Recent transactions
* Recent inventory activity

Reports should be based on actual PostgreSQL data.

\---

# 17\. HCI REQUIREMENTS

Apply actual Human-Computer Interaction principles.

Prioritize:

### Visibility

Users should immediately understand:

* where they are
* what they can do
* what happened after an action

### Consistency

Use consistent:

* buttons
* forms
* labels
* tables
* navigation
* error messages
* confirmation dialogs

### Error Prevention

Prevent:

* negative quantities
* selling unavailable stock
* invalid dates
* duplicate barcodes
* invalid prices
* invalid user roles
* accidental destructive actions

### Feedback

After actions, clearly show:

* success
* failure
* validation errors
* loading states

### Recognition over Recall

Use:

* searchable dropdowns
* clear labels
* icons with text
* contextual information
* autocomplete where useful

### Accessibility

Consider:

* readable font sizes
* sufficient contrast
* keyboard navigation
* visible focus states
* descriptive labels
* accessible form controls

\---

# 18\. ISO 27001-ALIGNED SECURITY

Design the system with **ISO/IEC 27001-aligned security practices** in mind.

Do NOT falsely claim that the application is "ISO 27001 certified."

Instead, implement security controls that are consistent with information-security-management principles.

Include:

* authentication
* authorization
* least privilege
* role separation
* audit logging
* secure password storage
* session security
* input validation
* access control
* data integrity
* backup procedures
* incident/audit visibility
* secure configuration
* secrets management
* error handling
* protection against common web vulnerabilities

Follow secure development practices.

Where applicable, consider OWASP principles.

Never expose:

* database credentials
* API secrets
* passwords
* private tokens

in the frontend.

Use environment variables for secrets.

\---

# 19\. SECURITY VALIDATION

Check for:

* SQL injection
* XSS
* CSRF where applicable
* broken access control
* insecure direct object references
* weak password handling
* unauthorized CRUD access
* exposed secrets
* unsafe error messages
* improper session handling
* mass assignment
* invalid input
* race conditions around inventory

Do not merely say these are protected.

Actually implement protections appropriate to the chosen stack.

\---

# 20\. DESIGN REHAUL

Completely redesign the interface to fit a professional pharmacy environment.

Design direction:

**Modern + Minimal + Professional + Functional**

Avoid:

* excessive gradients
* giant cards
* unnecessary animations
* excessive glassmorphism
* random decorative elements
* generic AI dashboard aesthetics
* huge hero sections
* excessive rounded rectangles
* meaningless statistics
* excessive icons

The system should look like software that could realistically be used by:

* pharmacy cashiers
* pharmacists
* administrators

during actual work.

Prioritize speed and clarity over visual spectacle.

\---

# 21\. NAVIGATION

Create a logical navigation structure.

Possible structure:

### Dashboard

* Overview
* Alerts
* Recent activity

### POS

* New Sale
* Cart
* Transactions
* Receipts

### Inventory

* Medicines
* Stock
* Stock Movements
* Expiring Medicines
* Low Stock

### Suppliers

* Suppliers
* Purchases
* Receiving

### Users

* Users
* Roles
* Account Status

### Reports

* Sales
* Inventory
* Transactions

### Audit

* Audit Logs

### System

* Backup
* Settings

Only display navigation items the logged-in role is authorized to access.

\---

# 22\. RESPONSIVE DESIGN

The system should work properly on:

* desktop
* laptop
* tablet

The POS should be optimized for desktop usage.

Do not sacrifice functionality merely to make it mobile-friendly.

\---

# 23\. ERROR HANDLING

Every major operation must have proper error handling.

Examples:

Database unavailable:

"Unable to connect to the database. Please try again."

Invalid login:

"Invalid username or password."

Unauthorized action:

"You do not have permission to perform this action."

Medicine not found:

"No medicine was found with this barcode."

Insufficient stock:

"Insufficient stock available."

Do not expose:

* SQL errors
* stack traces
* database credentials
* internal file paths
* sensitive backend information

to normal users.

\---

# 24\. DATA VALIDATION

Implement validation on BOTH:

* frontend
* backend

Validate:

* required fields
* email
* phone
* prices
* quantities
* dates
* barcode format
* usernames
* passwords
* roles

Never trust frontend validation alone.

\---

# 25\. DATABASE INTEGRITY

Use:

* primary keys
* foreign keys
* unique constraints
* indexes
* appropriate data types
* NOT NULL constraints where appropriate
* transactions
* cascading behavior carefully
* proper relationships

Prevent duplicate:

* usernames
* barcodes
* supplier records where appropriate

\---

# 26\. SEED DATA

Create realistic sample data for development/testing.

Include:

* Admin account
* Pharmacist account
* Cashier account
* Multiple suppliers
* Multiple medicine types
* Different stock levels
* Expiring medicine
* Low-stock medicine
* Sample sales
* Sample inventory transactions
* Sample audit logs

Clearly document development login credentials.

Do NOT use real people's personal information.

\---

# 27\. TESTING

Before considering the implementation complete, test:

## Authentication

* Admin login
* Pharmacist login
* Cashier login
* Incorrect password
* Disabled account
* Logout

## RBAC

Attempt unauthorized actions with each role.

## Medicines

* Create
* Read
* Update
* Delete/archive
* Search
* Filter

## Suppliers

* Create
* Read
* Update
* Deactivate

## POS

* Search medicine
* Scan barcode
* Add item
* Change quantity
* Insufficient stock
* Complete sale
* Calculate change
* Generate receipt

## Inventory

* Receive stock
* Sell stock
* Adjust stock
* Expired stock
* Low-stock detection

## Audit

Verify important actions generate audit records.

## Backup

Verify the configured backup operation actually works.

\---

# 28\. NO FAKE FUNCTIONALITY

This is extremely important.

Do NOT create buttons that only display:

"Coming soon"

"Success!"

"Data saved!"

without actually performing the operation.

Do NOT simulate:

* database operations
* authentication
* barcode scanning
* backups
* reports
* audit logs
* CRUD

Everything represented as functional must actually work.

If something genuinely cannot be implemented in the current environment, explain why and implement the closest real solution rather than faking it.

\---

# 29\. NO AI SLOP

The final application must NOT look AI-generated.

Avoid:

* unnecessary gradients
* excessive rounded cards
* random purple/blue color schemes
* oversized typography
* excessive whitespace
* generic SaaS dashboards
* fake statistics
* repetitive cards
* meaningless charts
* decorative animations
* unnecessary icons
* inconsistent terminology

Use a restrained pharmacy-oriented visual system.

Example design direction:

* white/light neutral background
* restrained pharmacy accent color
* strong readable typography
* clear tables
* compact forms
* obvious primary actions
* clear status indicators
* professional spacing
* minimal animation

Design should support the workflow rather than compete with it.

\---

# 30\. CODE QUALITY

Write maintainable code.

Use:

* reusable components
* clear naming
* separation of concerns
* typed interfaces where applicable
* centralized validation
* centralized authentication/authorization
* reusable database functions
* reusable error handling

Do not put the entire application into one huge component/file.

Do not duplicate logic unnecessarily.

Remove unused dependencies and code where appropriate.

\---

# 31\. ENVIRONMENT SETUP

Install all required dependencies.

Configure:

* PostgreSQL
* ORM
* migrations
* authentication dependencies
* barcode scanner library if needed
* validation library if needed
* UI dependencies where needed

Create/update:

`.env.example`

Never commit real secrets.

Document:

* installation
* environment variables
* database setup
* migrations
* seed process
* development server
* production build
* backup procedure

\---

# 32\. FINAL VERIFICATION

After implementation:

1. Start the application.
2. Verify the frontend loads.
3. Verify backend/API functionality.
4. Verify PostgreSQL connection.
5. Run migrations.
6. Run seed data.
7. Test login.
8. Test each role.
9. Test CRUD.
10. Test barcode scanning.
11. Test POS.
12. Test receipt generation.
13. Test inventory updates.
14. Test audit logs.
15. Test backup.
16. Check browser console for errors.
17. Check server logs.
18. Fix all obvious errors.
19. Check responsive behavior.
20. Check authorization boundaries.
21. Check database integrity.

Do not stop after making the UI.

The final product must be a **working pharmacy management system prototype backed by PostgreSQL**.

\---

# 33\. FINAL DELIVERABLE

When finished, provide:

### A. What was changed

Briefly explain the major changes.

### B. Technology stack

List:

* frontend
* backend
* database
* ORM
* authentication
* important libraries

### C. Database

Provide:

* schema overview
* migrations
* seed information

### D. User accounts

Provide development/test accounts and roles.

### E. Main features

Confirm implementation status of:

* Login
* RBAC
* Medicine CRUD
* Supplier CRUD
* User CRUD
* Inventory
* Barcode scanning
* POS
* Receipts
* Search/filter
* Audit logs
* Backup
* Reports

### F. Security

Explain the implemented security controls.

### G. Running the project

Give exact commands to:

* install
* configure environment
* create database
* migrate
* seed
* run development server
* build production version

\---

# MOST IMPORTANT INSTRUCTION

Do not treat this as a visual redesign task.

Treat it as a **real software engineering project**.

The priority order is:

**FUNCTIONALITY → DATA INTEGRITY → SECURITY → HCI/USABILITY → DESIGN**

The final application should feel like a realistic pharmacy information system that a student development team could demonstrate to a professor and actually operate during a live demonstration.

Do not invent functionality that does not exist.

Do not fake backend operations.

Do not fake database operations.

Do not fake authentication.

Do not fake barcode scanning.

Do not fake backups.

Do not claim ISO 27001 certification.

Build the actual system.

