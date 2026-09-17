# GSU Connect & Recover

Build a responsive web application: "GSU Item Matching and Recovery System"

PURPOSE:

A platform for Gombe State University students and staff to report lost and found items and automatically match them to aid recovery on GSU Tudun Wada Campus.

TECH STACK:

Frontend: React + Tailwind CSS

Backend: Supabase for Auth, Database, and Storage

Design: Clean, modern, mobile-first. Use GSU colors: Blue and White. Include GSU logo placeholder.

USER ROLES:

1. Student - Login with Matric No + Password

2. Staff - Login with Staff ID + Password  

3. Admin - SUG/Security Admin to manage claims

CORE FEATURES:

1.  Authentication: Signup/Login with Matric No or Staff ID. Select Department and Faculty during signup.

    Faculties: Faculty of Science, Faculty of Education, Faculty of Arts, Faculty of Law, Faculty of Social Sciences

    Departments: Computer Science, Economics, etc - make it a dropdown

2.  Report Lost Item Form:

    Fields: Item Name, Category, Description, Location Lost, Date Lost, Image Upload

    Location Dropdown: GSU Library, Faculty of Science, Faculty of Arts, Male Hostel, Female Hostel, Central Mosque, Cafeteria, GSU Main Gate

3.  Report Found Item Form:

    Same fields as above + "Kept At" dropdown: SUG Office, Faculty Office, Security Office

4.  Matching Engine: 

    Automatically show "Possible Matches" when a user posts. Match by Item Name + Category + Location + Date range

5.  Dashboard:

    My Lost Items, My Found Items, Possible Matches, Notifications

6.  Claim Process:

    User can click "This is mine" and it sends request to Admin. Admin approves and marks as "Claimed"

7.  Admin Panel:

    View all items, verify users, approve claims, mark item as "Returned"

DATABASE SCHEMA:

Tables: users, lost_items, found_items, matches, claims

Include fields: matric_no, department, faculty, location, status

OTHER:

Make it fast, clean, and easy to use on phone. Add search and filter by category and location.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6cb6ef62-031f-472b-90e8-03cb895e2dac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
