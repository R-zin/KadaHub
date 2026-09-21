# KadaHub Role-Based Access Control (RBAC) Guide

This document defines the authoritative access matrix, permissions, and security boundaries across all four user roles in the **KadaHub E-Commerce Management System**.

---

## 1. Role Matrix Overview

| Feature / Resource | Customer | Seller | Delivery Agent | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Catalog, Categories & Search** | Allowed | Allowed | Allowed | Allowed |
| **Manage Shopping Cart & Wishlist** | Allowed | Prohibited | Prohibited | Prohibited |
| **Checkout & Pay via Razorpay** | Allowed | Prohibited | Prohibited | Prohibited |
| **View Own Orders & Order Details** | Allowed | Prohibited | Prohibited | Prohibited |
| **Live Camera Capture & Try-On Pipeline** | Allowed | Allowed | Allowed | Allowed |
| **Request Order Return** | Allowed (Delivered only) | Prohibited | Prohibited | Prohibited |
| **Create / Update / Delete Products** | Prohibited (403) | Allowed (Own products only) | Prohibited (403) | Allowed (All products) |
| **Update Inventory & Stock Levels** | Prohibited (403) | Allowed (Own products only) | Prohibited (403) | Allowed (All products) |
| **View Seller Orders & Financials** | Prohibited (403) | Allowed (Own items only) | Prohibited (403) | Allowed |
| **View Assigned Delivery Orders** | Prohibited (403) | Prohibited (403) | Allowed (Assigned only) | Allowed |
| **Claim Unassigned Delivery Orders** | Prohibited (403) | Prohibited (403) | Allowed | Allowed |
| **Advance Order Delivery Status** | Prohibited (403) | Prohibited (403) | Allowed (Assigned only) | Allowed |
| **Assign Delivery Agent to Order** | Prohibited (403) | Prohibited (403) | Prohibited (403) | Allowed |
| **Approve / Reject Return & Issue Refund** | Prohibited (403) | Prohibited (403) | Prohibited (403) | Allowed |
| **View System Analytics & Platform Stats** | Prohibited (403) | Prohibited (403) | Prohibited (403) | Allowed |
| **Manage Users & Role Status (Active/Deactive)** | Prohibited (403) | Prohibited (403) | Prohibited (403) | Allowed |

---

## 2. Customer Role

Customers represent end-user shoppers who browse the catalog, manage cart items, place orders, make payments, track packages, and submit returns.

### Allowed Actions
- **Catalog Navigation**: Browse products, view product details, search by keyword, filter by categories/subcategories/price range.
- **Cart Management**: Add products to cart, update item quantities, remove items from cart, clear entire cart.
- **Wishlist Management**: Add items to personal wishlist, view wishlist items, remove items from wishlist.
- **Virtual Try-On Input**: Access Try-On interface, launch live device camera preview, capture selfie/full-body photo, retake capture, upload image files, generate Try-On previews, view Try-On result history, and cancel/delete temporary images.
- **Checkout & Payment**: Initiate checkout, generate server-signed Razorpay orders in INR/paise, pay using Razorpay test mode, submit signature verification, and create confirmed orders.
- **Order Tracking**: View personal order history (`/api/orders`), view individual order status and delivery tracking timeline.
- **Returns**: Submit return requests on delivered orders with human-readable reasons (`/api/returns`).
- **Profile & Notifications**: Update personal shipping addresses, view notifications, mark notifications as read.

### Forbidden Actions
- **No Product Mutation**: Cannot create, edit, update price, adjust stock, or delete catalog products (`POST/PUT/DELETE /api/products` returns `403 Forbidden`).
- **No Seller Data Access**: Cannot view other sellers' products, sales figures, or revenue reports.
- **No Cross-Customer Order Peeking**: Cannot view or query other customers' orders or shipping details (`403 Forbidden` / `404 Not Found`).
- **No Delivery Status Progression**: Cannot advance delivery statuses or claim delivery tasks (`POST /api/orders/:id/advance` returns `403 Forbidden`).
- **No Return Self-Approval**: Cannot approve or reject return requests, or trigger self-refunds (`POST /api/returns/:id/approve` returns `403 Forbidden`).
- **No Admin Capabilities**: Cannot query `/api/admin/*`, retrieve platform statistics, or modify user accounts.
- **No Role Self-Elevation**: Cannot register with `role: 'admin'` or modify role via profile endpoints.

---

## 3. Seller Role

Sellers are merchant accounts authorized to manage their store catalog, configure product attributes, monitor stock levels, and review orders containing their products.

### Allowed Actions
- **Product Creation**: Create new products with title, description, price, stock, category, subcategory, specifications, and multiple images (`POST /api/products`).
- **Product Management**: Update product details, modify pricing, change product descriptions, and upload replacement images for owned products (`PUT /api/products/:id`).
- **Inventory Control**: Update stock quantities for owned products (`PATCH /api/products/:id/stock`).
- **Product Deletion**: Delete unsold products or soft-archive products with order history (`DELETE /api/products/:id`).
- **Order Monitoring**: View incoming customer orders containing items sold by the seller (`GET /api/orders`).
- **Try-On Preview**: View product virtual try-on previews to verify clothing fit visualization.

### Forbidden Actions
- **No Cross-Seller Interference**: Cannot edit, update stock, or delete products owned by other sellers (`403 Forbidden`).
- **No Admin Access**: Cannot view global platform analytics, audit logs, or system revenue (`403 Forbidden`).
- **No Delivery Status Progression**: Cannot update shipping milestones or claim delivery packages (`403 Forbidden`).
- **No Return Approval or Refund Authorization**: Cannot approve return requests or disburse refunds (`403 Forbidden`).
- **No User Management**: Cannot create, deactivate, or alter roles of other users.

---

## 4. Delivery Agent Role

Delivery agents are logistics personnel responsible for transporting packages, managing delivery handoffs, and recording status progression.

### Allowed Actions
- **Assigned Orders**: View all orders assigned to the authenticated delivery agent (`GET /api/orders`).
- **Unassigned Orders**: View unassigned orders awaiting courier pickup (`GET /api/orders?unassigned=true`).
- **Claiming Deliveries**: Claim unassigned orders placed by customers (`POST /api/orders/:id/claim`).
- **Delivery Status Progression**: Sequentially progress delivery lifecycle milestones (`POST /api/orders/:id/advance`):
  1. `Payment Confirmed`
  2. `Processing`
  3. `Dispatched`
  4. `Shipped`
  5. `Out for Delivery`
  6. `Delivered`
- **Delivery Notes**: Add logistical notes or delivery completion confirmations.

### Forbidden Actions
- **No Cross-Agent Interference**: Cannot advance status, cancel, or reassign orders assigned to a different delivery agent (`403 Forbidden`).
- **No Post-Delivery Alteration**: Cannot modify, regress, or advance orders once marked `Delivered` (`400 Bad Request`).
- **No Product Catalog Mutations**: Cannot create, modify, or delete products (`403 Forbidden`).
- **No Financials or Return Approvals**: Cannot issue refunds, approve returns, or view administrative revenue statistics (`403 Forbidden`).
- **No Customer Order Tampering**: Cannot change order items, customer addresses, or payment amounts.

---

## 5. Admin Role

Administrators have governance and financial authority over the KadaHub platform.

### Allowed Actions
- **Platform Analytics**: View real-time platform statistics (`totalOrders`, `totalSales`, `activeUsers`, `lowStockItems`, `pendingReturns`, `activeDeliveries`) via `GET /api/admin/stats`.
- **User Management**: View all users across all roles, provision new administrative or delivery accounts, activate and deactivate users (`GET/POST /api/admin/users`, `PATCH /api/admin/users/:id/status`).
- **Global Catalog Oversight**: View, edit, update stock, or remove any product across all sellers.
- **Return & Refund Governance**: Review customer return requests, approve returns, disburse automated refunds via payment gateways, and restore inventory (`POST /api/returns/:id/approve`, `POST /api/returns/:id/reject`).
- **Delivery Dispatch**: Assign or reassign any delivery order to available delivery agents (`POST /api/orders/:id/assign`).
- **Order Management**: Search, filter, and review all orders across the system.

### Forbidden Actions
- **No Role Escalation on Public Signups**: Admin privileges can never be granted through the public `/api/auth/register` endpoint (strictly restricted to `customer` and `seller`).
- **No Self-Deactivation**: Administrators cannot deactivate their own active account, preventing orphan lockouts.
- **No Bypassing Transactional Integrity**: Even administrators cannot issue duplicate refunds or violate database foreign key constraints.
