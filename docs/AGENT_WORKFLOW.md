# College Project Management System - Agent Workflow

**Last Updated:** August 25, 2026

## Table of Contents
1. [System Overview](#system-overview)
2. [Actor Roles](#actor-roles)
3. [Document Submission Workflow](#document-submission-workflow)
4. [Team Peer Review Workflow](#team-peer-review-workflow)
5. [Supervisor Review Workflow](#supervisor-review-workflow)
6. [Admin Review Workflow](#admin-review-workflow)
7. [Project Timeline](#project-timeline)
8. [Status Definitions](#status-definitions)
9. [API Endpoints](#api-endpoints)
10. [Database Schema](#database-schema)

---

## System Overview

The College Project Management System is a multi-stage submission and review platform for student projects. It manages the entire lifecycle of project submissions from student upload through supervisor and admin review.

### Key Features
- **Multi-Stage Submissions**: Synopsis, Progress 1, Progress 2, Final Submission
- **Peer Review System**: Team members must approve submissions before supervisor review
- **Role-Based Access Control**: Students, Supervisors, Admins
- **Document Tracking**: Complete history of all submissions and reviews
- **Meeting Management**: Schedule and track review meetings
- **Notification System**: Email notifications for all role changes

---

## Actor Roles

### 1. Student (Team Member)
**Responsibilities:**
- Submit project deliverables for assigned stages
- Review and approve team members' submissions (peer review)
- Respond to feedback requests from supervisors
- Provide revision uploads when requested

**Capabilities:**
- Upload documents (with file URL)
- View peer approval votes
- See submission status and feedback
- Access project timeline and meetings

**Dashboard Access:**
- Student Projects page
- My Submissions & Deliverables Tracking
- Team Review queue (peer approvals)
- Project timeline with meetings

---

### 2. Supervisor (Faculty Advisor)
**Responsibilities:**
- Review submissions after all team members approve
- Provide feedback or approve documents
- Track deliverable history
- Assign grades to submissions
- Schedule meetings with teams

**Capabilities:**
- View pending submissions (waiting for supervisor review)
- Approve or request changes on submissions
- View full approval history
- Access team composition and member info
- Schedule/reschedule meetings
- Issue milestone grades

**Dashboard Access:**
- My Assigned Projects
- Last Submission card (pending review)
- Deliverables Tracking (approved history)
- Team Composition
- Project Timeline
- Meeting Management

---

### 3. Admin (Project Coordinator)
**Responsibilities:**
- Configure project forms and templates
- Manage student and supervisor enrollments
- Create and manage projects
- Track all submissions across projects
- View analytics and statistics
- Manage project settings and deadlines

**Capabilities:**
- View all projects and submissions
- Create/edit project configurations
- Manage form templates
- View project timelines with deliverables
- Access comprehensive reporting
- Manage admin meetings

**Dashboard Access:**
- Admin Projects Overview
- Form View Config
- Students list
- Supervisors list
- Project detail drawers with deliverables

---

## Document Submission Workflow

### Stage 1: Initial Submission

```
[Student Uploads] → [Document Created] → [Status: PENDING]
```

**Flow:**
1. Student accesses project's current stage
2. Student uploads document via DeliverableUploader
3. API: `POST /submissions/{stage}` → Creates submission record
4. Initial status: `PENDING` (awaiting team review)
5. `teamReviewJson`: `[]` (empty votes)
6. `visibleToSupervisor`: `false` (hidden until peer approved)

**Data Fields:**
- `submissionId`: Unique identifier (syn_, pg1_, pg2_, fnl_ prefix)
- `documentId`: Parent document reference
- `projectId`: Associated project
- `leaderId`: Student who uploaded
- `fileName`: Document name
- `fileUrl`: Cloud storage URL
- `uploadedAt`: ISO timestamp
- `versionNo`: Incremental version
- `status`: `PENDING`
- `teamReviewJson`: `[]`
- `teamReviewStatus`: `PENDING`

---

## Team Peer Review Workflow

### Stage 2: Peer Approval

```
[Document Pending] → [Team Review] → [PENDING_SUPERVISOR_REVIEW] OR [REVISION]
```

**Flow:**
1. Team members (excluding leader) access submission
2. Each member votes: **Approve** or **Reject**
3. API: `PATCH /submissions/{stage}/{id}/team-review`
4. Vote recorded in `teamReviewJson`:
   ```json
   [
     {
       "reviewerId": "stu_...",
       "approved": true,
       "comment": "...",
       "reviewedAt": 1234567890
     }
   ]
   ```

**Vote Outcomes:**

#### **Scenario A: Any member rejects**
- `status` → `REVISION`
- `teamReviewStatus` → `PENDING`
- `visibleToSupervisor` → `false`
- **Notification**: Leader notified to revise

#### **Scenario B: All members approve**
- `status` → `PENDING_SUPERVISOR_REVIEW` ✅
- `teamReviewStatus` → `PENDING_SRVR` (14 chars, DB constraint)
- `visibleToSupervisor` → `true` ✅
- **Notification**: Supervisor notified submission is ready

#### **Scenario C: Incomplete votes**
- `status` → `PENDING`
- `teamReviewStatus` → `PENDING`
- `visibleToSupervisor` → `false`
- Waiting for remaining votes

**Vote Tracking:**
- Each vote recorded with timestamp
- Prevents duplicate votes from same reviewer
- Cannot change vote (must upload new version for revision)

---

## Supervisor Review Workflow

### Stage 3: Supervisor Approval/Rejection

```
[PENDING_SUPERVISOR_REVIEW] → [Supervisor Decision] → [APPROVED] OR [REVISION]
```

**Frontend UI:**
- **Last Submission Card**: Shows pending documents ready for review
  - Document name, stage badge, upload date
  - **"Approve"** button → Approves document
  - **"Request to Change"** button → Opens feedback modal

**Backend Flow:**

#### **Approve Decision**
```
API: PATCH /submissions/{stage}/{id}/supervisor-review
{
  "supervisorId": "sup_...",
  "approved": true,
  "marks": 0,
  "comment": "..."
}
```

Result:
- `status` → `APPROVED` ✅
- `visibleToAdmin` → `true`
- Document moves to **Deliverables Tracking** card
- Milestone grade applied if provided

#### **Request Changes Decision**
```
API: PATCH /submissions/{stage}/{id}/supervisor-review
{
  "supervisorId": "sup_...",
  "approved": false,
  "comment": "Please revise: ..."
}
```

Result:
- `status` → `REVISION`
- `visibleToSupervisor` → `false`
- `visibleToAdmin` → `false`
- **Notification**: Team leader receives feedback

**Supervisor Dashboard:**
- **Last Submission Card**: Shows `PENDING_SUPERVISOR_REVIEW` documents
- **Deliverables Tracking Card**: Shows `APPROVED` documents
  - Can view, download, or preview approved files
  - Shows submission date and stage

---

## Admin Review Workflow

### Stage 4: Admin Final Review (Optional)

```
[APPROVED by Supervisor] → [Admin Review] → [APPROVED] (Final)
```

**Flow:**
1. Admin views project in AdminProjectDetailDrawer
2. Sees all submissions with current status
3. Can view timeline with deliverable icons
4. May perform final review if configured

**Admin Features:**
- **Project Timeline Card**:
  - Current Stage badge (highlighted)
  - Deliverable file icons under each stage
  - Document names with click-to-preview links
  - Visual timeline of project progress

- **Deliverables by Stage Section**:
  - Lists all submissions grouped by stage
  - Shows status (APPROVED, REJECTED, PENDING_SRVR)
  - Upload date and file preview access

---

## Project Timeline

### Timeline Stages

```
SYNOPSIS (Red)
    ↓
PROGRESS 1 (Green)
    ↓
PROGRESS 2 (Purple)
    ↓
FINAL SUBMISSION (Blue)
```

### Timeline Components

#### **Student View:**
- Current stage highlighted
- Deliverables under each stage
- Team members working on stage
- Supervisor feedback visible

#### **Supervisor View:**
- Deadline for each stage
- Current stage badge
- Submission count
- Peer approval status
- "Last Submission" shows pending items

#### **Admin View:**
- All deliverables with file icons
- Stage status and progress
- Submission history
- Click-to-preview functionality

### Timeline Data Structure

```javascript
{
  stage: "SYNOPSIS",
  stageLabel: "Synopsis",
  dateField: "synopsisDate",
  deadline: "2026-08-26",
  color: "#ef4444",
  endpoint: "synopsis",
  submissions: [
    {
      fileName: "Word Document",
      status: "PENDING_SUPERVISOR_REVIEW",
      uploadedAt: "2026-08-25T06:29:52Z",
      fileUrl: "https://drive.google.com/..."
    }
  ]
}
```

---

## Status Definitions

### Submission Status Enum

```
PENDING
  ├─ Initial state after student upload
  └─ Also: Incomplete peer votes

PENDING_SUPERVISOR_REVIEW ⭐
  ├─ All team members approved
  ├─ Visible to supervisor
  └─ Awaiting supervisor decision

APPROVED ✅
  ├─ Supervisor approved
  ├─ Ready for admin review
  └─ Visible in Deliverables Tracking

REJECTED ❌
  ├─ Supervisor rejected
  └─ Team must revise and resubmit

REVISION
  ├─ Peer rejected OR supervisor requested changes
  ├─ Feedback provided in comments
  └─ Team must upload new version
```

### Team Review Status

Internal status tracking for peer review process:

```
PENDING
  └─ Awaiting team votes

PENDING_SRVR (Shortened: 14 chars)
  └─ All team members approved
  └─ Equivalent to PENDING_SUPERVISOR_REVIEW in main status

APPROVED
  └─ Team consensus reached

REVISION
  └─ At least one member rejected
```

---

## API Endpoints

### Submission Endpoints

#### **Create Submission**
```http
POST /submissions/{stage}
Content-Type: application/json

{
  "documentId": "doc_...",
  "fileUrl": "https://drive.google.com/...",
  "fileName": "Word Document",
  "comment": "Initial submission"
}

Response: 201 Created
{
  "synopsisId": "syn_...",
  "status": "PENDING",
  "teamReviewJson": "[]",
  "visibleToSupervisor": false
}
```

#### **Get Submission by Document**
```http
GET /submissions/{stage}/document/{documentId}
Header: X-User-ID: stu_...

Response: 200 OK
[
  {
    "synopsisId": "syn_...",
    "status": "PENDING_SUPERVISOR_REVIEW",
    "teamReviewJson": "[...]",
    "fileName": "...",
    "uploadedAt": "2026-08-25T06:29:52Z"
  }
]
```

#### **Team Review (Peer Approval)**
```http
PATCH /submissions/{stage}/{submissionId}/team-review
Header: X-User-ID: stu_...
Content-Type: application/json

{
  "reviewerId": "stu_...",
  "approved": true,
  "comment": "Looks good"
}

Response: 200 OK
{
  "status": "PENDING_SUPERVISOR_REVIEW",
  "teamReviewStatus": "PENDING_SRVR",
  "visibleToSupervisor": true
}
```

#### **Supervisor Review**
```http
PATCH /submissions/{stage}/{submissionId}/supervisor-review
Header: X-User-ID: sup_...
Content-Type: application/json

{
  "supervisorId": "sup_...",
  "approved": true,
  "marks": 85,
  "comment": "Great work"
}

Response: 200 OK
{
  "status": "APPROVED",
  "visibleToAdmin": true
}
```

---

## Database Schema

### Submission Tables

```sql
-- Common fields across all submission types
CREATE TABLE synopsis (
  synopsis_id VARCHAR(30) PRIMARY KEY,
  project_id VARCHAR(30) NOT NULL,
  document_id VARCHAR(30) NOT NULL,
  leader_id VARCHAR(30) NOT NULL,
  version_no INTEGER NOT NULL,
  
  -- File Storage
  file_url VARCHAR(1000),
  file_name VARCHAR(255),
  
  -- Status Tracking
  status VARCHAR(30) NOT NULL CHECK (
    status IN ('PENDING', 'PENDING_SUPERVISOR_REVIEW', 'APPROVED', 'REJECTED', 'REVISION')
  ),
  team_review_status VARCHAR(20) NOT NULL CHECK (
    team_review_status IN ('PENDING', 'PENDING_SRVR', 'APPROVED', 'REJECTED', 'REVISION')
  ),
  
  -- Peer Review
  team_review_json JSONB NOT NULL DEFAULT '[]',
  
  -- Visibility
  visible_to_supervisor BOOLEAN DEFAULT FALSE,
  visible_to_admin BOOLEAN DEFAULT FALSE,
  
  -- Comments
  comment TEXT,
  comment_by_role VARCHAR(20),
  comment_by_id VARCHAR(30),
  
  -- Timestamps
  uploaded_at TIMESTAMP NOT NULL,
  revision_of VARCHAR(30)
);
```

### Team Review JSON Structure

```json
[
  {
    "reviewerId": "stu_ab7443d6930d4c1198242859ce",
    "approved": true,
    "comment": "Looks good, ready for submission",
    "reviewedAt": 1787639449.772656556
  },
  {
    "reviewerId": "stu_4c34757a933044d5b47c20dd8a",
    "approved": true,
    "comment": "",
    "reviewedAt": 1787639573.713005177
  }
]
```

---

## Key Improvements & Fixes (August 25, 2026)

### Issue #1: Documents Not Showing After Peer Approval
**Fix:**
- Added `PENDING_SUPERVISOR_REVIEW` status to properly track submissions awaiting supervisor review
- Updated `teamReview()` to set this status when all members approve
- Updated `supervisorReview()` to accept this status for approval

### Issue #2: Database Constraint Error
**Fix:**
- Created migration to add `PENDING_SUPERVISOR_REVIEW` to status check constraints
- Use shortened `PENDING_SRVR` (14 chars) for `team_review_status` field (20 char limit)

### Issue #3: Frontend Not Fetching Submissions
**Fix:**
- Fixed order of operations: fetch submissions AFTER project is loaded
- Changed endpoint from non-existent `/submissions/all/document/{id}` to correct `/submissions/{stage}/document/{id}`
- Fetch from all 4 stages in parallel

---

## Deployment Checklist

- [ ] Run database migration: `2026-08-25_add_pending_supervisor_review_status.sql`
- [ ] Rebuild backend: `./mvnw clean package`
- [ ] Rebuild frontend: `npm run build`
- [ ] Restart backend service
- [ ] Restart frontend service
- [ ] Test submission flow: upload → peer review → supervisor review
- [ ] Verify supervisor dashboard shows pending submissions
- [ ] Verify timeline displays deliverables with correct status

---

## Troubleshooting

### Submission Not Appearing in Last Submission Card

**Check:**
1. Is `status` = `PENDING_SUPERVISOR_REVIEW`? ✅
2. Is `visibleToSupervisor` = `true`? ✅
3. Have all team members voted? ✅
4. Is supervisor logged in? ✅

**Fix:**
- Refresh page (F5)
- Check browser console for API errors
- Verify database migration was applied

### Timeline Shows Status But Card is Empty

**Check:**
1. Are submissions being fetched? Check Network tab
2. Are endpoints returning data? Check API response
3. Is `documentId` correctly set on project? ✅

**Fix:**
- Verify project has `documentId` field
- Check that submissions exist in database
- Verify supervisor has access permissions

---

## Future Enhancements

1. **Batch Operations**: Approve/reject multiple submissions
2. **Email Notifications**: Better notification system
3. **Version Control**: Track revision history
4. **Rubric-Based Grading**: Structured feedback templates
5. **Analytics Dashboard**: Project completion metrics
6. **Mobile App**: iOS/Android native apps
7. **Webhooks**: Integration with external systems

---

**Document Version:** 1.0  
**Last Reviewed:** August 25, 2026  
**Next Review:** September 30, 2026
