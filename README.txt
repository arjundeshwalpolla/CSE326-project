CAMPUSFIT ADMIN + BOOKING SYSTEM

WHAT IT DOES
- Students can book a sports facility without logging in.
- Booking details (name, roll number, facility, date, time and booking ID) are stored in data.json on the server.
- Only the admin account can view all student booking details and cancel bookings.
- Equipment borrowing records are also stored on the server; admin can mark equipment returned.
- Students can see slot availability but cannot see other students' personal details.

DEFAULT DEMO ADMIN LOGIN
Admin ID: campusadmin
Password: FitAdmin@2026

IMPORTANT SECURITY NOTE
This is a classroom/demo project. Change the default password before sharing or deploying it.
The demo server stores data in a local JSON file and sessions in server memory. For a real public college website, use HTTPS, a proper database, secure password hashing, persistent sessions, backups and appropriate access controls. Do not expose the demo password to students.

HOW TO RUN ON WINDOWS
1. Install Node.js LTS from https://nodejs.org/ if it is not installed.
2. Extract the ZIP folder.
3. Open the extracted folder.
4. Click the folder address bar in File Explorer, type cmd and press Enter.
5. In the terminal, run: node server.js
6. Open http://localhost:3000 in Chrome.
7. Students can use the booking form. Click Admin Login and use the demo credentials to see all bookings.

To stop the server, click the terminal and press Ctrl+C.

CHANGE ADMIN CREDENTIALS (recommended)
In Command Prompt before starting the server, run:
set ADMIN_ID=your_new_admin_id
set ADMIN_PASSWORD=your_new_strong_password
node server.js

This works on the same computer. To let other students on other devices book into the same shared system, the server must be hosted on a network/server and be reachable by those devices. Opening index.html directly will not work; use http://localhost:3000.
