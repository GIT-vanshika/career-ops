# Modo: contacto — LinkedIn Outreach

Use this whenever the candidate wants to reach out after finding, evaluating, or applying to a role. The goal is to help the candidate identify likely hiring contacts and draft messages. Never send, connect, or submit anything on the candidate's behalf.

## When To Run

- After a role is selected for application from scan/pipeline
- After a high-fit evaluation
- After the candidate confirms they applied
- When the candidate explicitly asks for LinkedIn outreach

## Contact Discovery

Use WebSearch/search engine queries, not automated LinkedIn scraping. LinkedIn may require login and must be used manually by the candidate.

Search for the company + role using these patterns:

1. `site:linkedin.com/in "{Company}" recruiter OR "talent acquisition" OR "university recruiter" OR "campus recruiter"`
2. `site:linkedin.com/in "{Company}" "{Role Family}" "hiring manager" OR "manager" OR "lead"`
3. `site:linkedin.com/in "{Company}" "data analyst" OR "machine learning" OR "AI" OR "data science"`
4. `site:linkedin.com/in "{Company}" "early talent" OR "university hiring" OR "campus hiring"`

For each useful result, capture:

| Priority | Name | LinkedIn URL | Current title | Why this person | Confidence |
|----------|------|--------------|---------------|-----------------|------------|

Target priority:

1. Recruiter, university recruiter, campus recruiter, early talent recruiter
2. Hiring manager or team lead for data, ML, AI, analytics, or engineering
3. Peer on the same team who may know the hiring manager
4. Company employee in a nearby function only if no recruiter/manager is visible

If no exact profiles are found, provide LinkedIn search URLs for the candidate to open manually.

## Message Drafts

Generate 3 drafts:

1. **Connection request**: under 300 characters
2. **Follow-up after they accept**: 3-5 sentences
3. **Post-application note**: 3-5 sentences mentioning the role was applied to

Framework:

- Sentence 1: Specific role/company context
- Sentence 2: One real proof point from `cv.md` or `article-digest.md`
- Sentence 3: Simple ask for guidance, referral direction, or the right contact

Use Vanshika's positioning:

- ECE student targeting Data Analyst, ML Intern, AI Intern, and Data Science Intern roles
- Strongest proof points: AICTE data analytics work, 30+ ML project evaluations, hyperspectral imaging research, edge computer vision, satellite anomaly detection, cybersecurity ML
- Keep the tone polite, student-appropriate, concise, and non-pushy

## Output Format

Add this to the report or outreach file:

```markdown
## H) LinkedIn Outreach

### Hiring Contacts To Review
| Priority | Name | LinkedIn URL | Current title | Why this person | Confidence |
|----------|------|--------------|---------------|-----------------|------------|

### LinkedIn Search Links
- Recruiters: ...
- Hiring manager/team lead: ...
- Team peers: ...

### Message Drafts

#### Connection Request
...

#### Follow-Up After Accept
...

#### Post-Application Note
...

### Safety Notes
- Do not send automatically.
- Verify the person's current company and title before messaging.
- Do not share phone number, Aadhaar, payment details, or documents in LinkedIn messages.
- Never pay for referrals, certificates, training, or application processing.
```

## Rules

- Maximum 300 characters for connection requests
- No corporate-speak
- No "I'm passionate about..."
- No fake familiarity
- No invented contact names, titles, or LinkedIn URLs
- Never share phone number in outreach
- Never ask directly for "a job"; ask for guidance, the right contact, or whether they are the right person for the role
