# BlessERP — ERPNext 15 Field Mapping & Implementation Plan

## Phase 0: ERPNext API Layer & Foundation

### Frappe REST API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/method/frappe.auth.login | Login |
| GET | /api/method/frappe.auth.get_logged_user | Current user |
| GET | /api/resource/{doctype} | List documents |
| GET | /api/resource/{doctype}/{name} | Get single document |
| POST | /api/resource/{doctype} | Create document |
| PUT | /api/resource/{doctype}/{name} | Update document |
| DELETE | /api/resource/{doctype}/{name} | Delete document |
| POST | /api/method/frappe.client.submit | Submit document |
| POST | /api/method/frappe.client.cancel | Cancel document |

### Auth Flow
- Login: POST /api/method/frappe.auth.login with usr and pwd
- Session cookie sid handled automatically via withCredentials

### List Pattern
GET /api/resource/{doctype}?fields=[...]&filters=[...]&limit_start=0&limit_page_length=20&order_by=modified desc

### Get Pattern
GET /api/resource/{doctype}/{name}

### Submit Pattern
POST /api/resource/{doctype}/{name} Body: {"docstatus": 1}
POST /api/method/frappe.client.cancel Body: {"doctype": "...", "name": "..."}
