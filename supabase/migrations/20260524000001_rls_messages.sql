-- Enable RLS on messages table

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_messages ON messages
    FOR ALL
    USING (user_id = auth.uid());
