IT Trouble Ticketing System

A full-stack IT trouble-ticketing web application designed for small teams or organizations to report, manage, and resolve technical issues.

Built with modern web technologies including Next.js (App Router), MongoDB, Tailwind CSS, and TypeScript, the system includes built-in Role-Based Access Control (RBAC) and a clean UI for admins and users alike.

---

🚀 Features

- RBAC with Admin Controls
  - Admin-only ticket deletion
  - User-specific access restrictions
- Ticket Management
  - Submit, edit, and delete IT support tickets
  - View tickets in real time
- User System
  - Account-based access (admin vs standard user)
- Custom Confirmation Modals
  - Safe deletion flows with modals
- Fast UI with Tailwind
  - Responsive and minimal design for performance

---

🧰 Tech Stack

- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Backend: MongoDB, NextAuth for authentication
- State/Logic: Server Actions, React hooks
- Styling: Tailwind CSS, custom modal components
- Deployment: Vercel-ready setup (including .gitignore and deployment optimizations)

---

🛠️ Installation & Setup

$ git clone https://github.com/msb418/it-trouble-ticketing.git
$ cd it-trouble-ticketing
$ npm install

(Create a .env file with your environment variables and MongoDB URI)

$ npm run dev

---

📦 Deployment

This app is ready for deployment on Vercel out of the box. Configure your MongoDB URI and environment secrets via Vercel Dashboard.

---

💼 About This Project

This project was built independently as a portfolio showcase to demonstrate:

- Full-stack application architecture
- Secure permission systems (RBAC)
- Clean UI/UX considerations
- Rapid development with AI-assisted coding tools

---

🪪 License

MIT — feel free to use, modify, and adapt for personal or commercial use.

---

🤝 Contact

Author: Matt Bureau
LinkedIn: www.linkedin.com/in/matthew-b-69326015
