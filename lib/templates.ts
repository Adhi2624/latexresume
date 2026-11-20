export interface Template {
  id: string;
  name: string;
  description: string;
  tags: string[];
  latexSource: string;
}

const classic = String.raw`\documentclass[11pt,letterpaper]{article}
\usepackage[margin=0.8in]{geometry}
\usepackage[T1]{fontenc}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\usepackage{enumitem}
\pagestyle{empty}
\titleformat{\section}{\large\bfseries\scshape}{}{0em}{}[\titlerule]
\titlespacing{\section}{0pt}{10pt}{5pt}
\setlist[itemize]{leftmargin=1.2em,itemsep=2pt,topsep=2pt}

\begin{document}

\begin{center}
  {\Huge\bfseries Jane Doe}\\[4pt]
  Software Engineer \quad|\quad San Francisco, CA\\
  \href{mailto:jane@example.com}{jane@example.com} \quad|\quad +1 (555) 123-4567 \quad|\quad \href{https://github.com/janedoe}{github.com/janedoe}
\end{center}

\section{Experience}
\textbf{Senior Software Engineer} \hfill 2022 -- Present\\
\textit{Acme Corp, San Francisco, CA}
\begin{itemize}
  \item Led a team of five engineers to rebuild the billing platform, cutting p95 latency by 40\%.
  \item Introduced automated testing that raised coverage from 45\% to 90\%.
\end{itemize}

\textbf{Software Engineer} \hfill 2019 -- 2022\\
\textit{Globex, Remote}
\begin{itemize}
  \item Built and shipped a real-time analytics dashboard used by 10,000+ customers.
\end{itemize}

\section{Education}
\textbf{B.S. in Computer Science} \hfill 2015 -- 2019\\
\textit{State University}

\section{Skills}
\textbf{Languages:} TypeScript, Python, Go, SQL \\
\textbf{Tools:} PostgreSQL, MongoDB, Docker, Kubernetes, AWS

\end{document}
`;

const modern = String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[margin=0.7in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}
\definecolor{accent}{HTML}{2563EB}
\pagestyle{empty}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{\MakeUppercase}[{\color{accent}\titlerule}]
\titlespacing{\section}{0pt}{12pt}{6pt}
\setlist[itemize]{leftmargin=1.1em,itemsep=1pt,topsep=2pt}

\begin{document}

{\Huge\bfseries Jane \color{accent}Doe}\\[2pt]
{\large Full-Stack Developer}\\[4pt]
\href{mailto:jane@example.com}{jane@example.com} \textbullet\ +1 (555) 123-4567 \textbullet\ \href{https://janedoe.dev}{janedoe.dev} \textbullet\ Berlin, Germany

\section{Summary}
Product-minded engineer with 7 years of experience shipping web applications, from prototype to scale.

\section{Experience}
\textbf{Staff Engineer}, Initech \hfill \textcolor{gray}{2021 -- Present}
\begin{itemize}
  \item Designed an event-driven architecture handling 5M events/day.
  \item Mentored 8 engineers; ran the company's engineering onboarding program.
\end{itemize}

\textbf{Software Engineer}, Hooli \hfill \textcolor{gray}{2017 -- 2021}
\begin{itemize}
  \item Shipped a self-serve onboarding flow that increased activation by 22\%.
\end{itemize}

\section{Education}
\textbf{M.Sc. Computer Science}, Tech University \hfill \textcolor{gray}{2015 -- 2017}

\section{Skills}
TypeScript $\cdot$ React $\cdot$ Node.js $\cdot$ PostgreSQL $\cdot$ MongoDB $\cdot$ Cloudflare Workers $\cdot$ Docker

\end{document}
`;

const compact = String.raw`\documentclass[9.5pt,letterpaper]{article}
\usepackage[margin=0.55in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=1em,itemsep=0pt,topsep=1pt,parsep=0pt}
\newcommand{\sect}[1]{\vspace{5pt}{\bfseries\MakeUppercase{#1}}\vspace{-3pt}\hrule\vspace{3pt}}

\begin{document}
\begin{center}
  {\LARGE\bfseries Jane Doe}\\
  jane@example.com \textbullet\ (555) 123-4567 \textbullet\ linkedin.com/in/janedoe \textbullet\ github.com/janedoe
\end{center}

\sect{Experience}
\textbf{Acme Corp} --- Senior Engineer \hfill 2022 -- Present
\begin{itemize}
  \item Owned the payments service (Go, PostgreSQL); 99.99\% uptime over 18 months.
  \item Reduced cloud spend by 30\% through right-sizing and caching.
\end{itemize}
\textbf{Globex} --- Engineer \hfill 2019 -- 2022
\begin{itemize}
  \item Built internal tooling that saved the support team 200+ hours per month.
\end{itemize}

\sect{Education}
\textbf{State University} --- B.S. Computer Science \hfill 2015 -- 2019

\sect{Skills}
Go, TypeScript, Python, SQL, MongoDB, Docker, Kubernetes, Terraform

\end{document}
`;

const blank = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\begin{document}

\section*{Your Name}
Start writing your resume here.

\end{document}
`;

export const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic', description: 'Traditional single-column layout with ruled section headings.', tags: ['traditional', 'ATS-friendly'], latexSource: classic },
  { id: 'modern', name: 'Modern', description: 'Sans-serif design with a blue accent colour.', tags: ['modern', 'colour'], latexSource: modern },
  { id: 'compact', name: 'Compact', description: 'Dense one-page layout for long work histories.', tags: ['dense', 'one-page'], latexSource: compact },
  { id: 'blank', name: 'Blank', description: 'A minimal starting point.', tags: ['minimal'], latexSource: blank },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);
