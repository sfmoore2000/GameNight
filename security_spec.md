# Security Specification - Game Night Tracker

## Data Invariants
1. A session entry must belong to an existing session.
2. Buy-in amounts must be positive.
3. Only the host can manage players, locations, and staff profiles.
4. Once a session is 'completed', entries should be immutable (except maybe by host for corrections).
5. All IDs must be valid strings.

## The Dirty Dozen Payloads (Attempts to bypass security)

1. **Identity Spoofing**: Attempt to create a player as a non-host user.
2. **Field Injection**: Attempt to add `isHost: true` to a player document.
3. **Negative Buy-in**: Attempt to add a buy-in with amount -500.
4. **Invalid session ID**: Attempt to create an entry for a non-existent session ID (e.g. `../../secret_collection/doc`).
5. **Session Hijacking**: Non-host user attempting to mark a session as `completed`.
6. **Orphaned Entry**: Create an entry with a player ID that doesn't exist in `/players`.
7. **Timestamp Spoofing**: Provide a `createdAt` in the past instead of using server time.
8. **Excessive String Payload**: Sending 1MB of text in a player's name.
9. **Status Jumping**: Moving a session from `scheduled` to `completed` without the `active` state (if logic enforces flow).
10. **Unauthorized Read**: Anonymous user attempting to list all players.
11. **Shadow Update**: Updating an entry with a field not in the schema.
12. **Double Cash-out**: Attempting to update `cashOutAmount` multiple times once session is closed.

## Test Runner (Logic Overview)
The `firestore.rules` will be tested using the Firestore emulator or the `fire-test` utility logic. 
Tests will verify that every one of the above payloads results in `PERMISSION_DENIED`.
