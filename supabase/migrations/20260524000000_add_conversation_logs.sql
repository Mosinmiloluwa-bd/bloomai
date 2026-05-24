-- Add conversation_logs table

CREATE TABLE IF NOT EXISTS conversation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    session_id UUID NOT NULL,
    turn_index INT NOT NULL,
    emotional_intensity TEXT,
    crisis_flag BOOLEAN DEFAULT FALSE,
    dependency_flag BOOLEAN DEFAULT FALSE,
    manipulation_flag BOOLEAN DEFAULT FALSE,
    model_used TEXT,
    fallback_triggered BOOLEAN DEFAULT FALSE,
    response_tokens INT,
    latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_logs_user_id ON conversation_logs(user_id);
CREATE INDEX idx_conversation_logs_crisis_flag ON conversation_logs(crisis_flag) WHERE crisis_flag = TRUE;
