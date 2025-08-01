--supabase_schema--
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "http";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- Users Table (linked to auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debate Setups Table (for pre-configured debate settings)
CREATE TABLE public.debate_setups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    general_instructions TEXT,
    -- sources JSONB should be an array of objects, e.g.:
    -- [
    --   {
    --     "source": "2023 IPCC Climate Report Summary",
    --     "topics": ["climate change", "emissions"],
    --     "prioritize": true
    --   },
    --   {
    --     "source": "Brookings Institute article on trade",
    --     "topics": ["economy", "trade policy"],
    --     "prioritize": false
    --   }
    -- ]
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Debates Table (represents a single debate session)
CREATE TABLE public.debates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    debate_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics Table (tracks topics discussed within a debate)
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instructions Table (stores AI prompts for a specific debate)
CREATE TABLE public.instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID NOT NULL UNIQUE REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    general_prompt TEXT,
    sources_prompt TEXT,
    primed_topics TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcripts Table (stores the full, concatenated transcript)
CREATE TABLE public.transcripts (
    debate_id UUID PRIMARY KEY REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    full_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcript Lines Table (stores individual lines for context fetching)
CREATE TABLE public.transcript_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (debate_id, line_number)
);

-- Debate Summaries Table (for post-debate analysis)
CREATE TABLE public.debate_summaries (
    debate_id UUID PRIMARY KEY REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_summary TEXT,
    opponent_summary TEXT,
    user_strength_score INTEGER,
    opponent_strength_score INTEGER,
    user_accuracy_score INTEGER,
    opponent_accuracy_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis Queue Table (triggers the deep-analysis-service)
CREATE TABLE public.analysis_queue (
    id BIGSERIAL PRIMARY KEY,
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    transcript_snippet TEXT NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('user', 'opponent')),
    line_number INTEGER,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card Type Enum for categorizing analysis cards
DROP TYPE IF EXISTS public.card_type;
CREATE TYPE public.card_type AS ENUM (
    'logical-fallacy',
    'evasion',
    'bad-faith-argument',
    'custom-finding',
    'verifiable-claim'
);

-- Analysis Cards Table (the central hub for all analysis and coaching)
CREATE TABLE public.analysis_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    card_type public.card_type NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('user', 'opponent')),
    data JSONB NOT NULL, -- Stores transcript snippet, analysis, fact-check, coaching, status, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function: Handle New User (syncs auth.users to public.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'avatar_url');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function: Append to Transcript (atomic operation to add a line and update full text)
CREATE OR REPLACE FUNCTION public.append_to_transcript(p_debate_id UUID, p_user_id UUID, new_chunk TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_line_number INTEGER;
BEGIN
    -- Get the next line number for the debate
    SELECT COALESCE(MAX(line_number), 0) + 1 INTO next_line_number
    FROM public.transcript_lines
    WHERE debate_id = p_debate_id;
    
    -- Insert the new line into transcript_lines
    INSERT INTO public.transcript_lines (debate_id, line_number, text, created_at)
    VALUES (p_debate_id, next_line_number, new_chunk, NOW());
    
    -- Update the full_text in the main transcripts table
    UPDATE public.transcripts
    SET full_text = COALESCE(full_text, '') || E'\n' || new_chunk,
        updated_at = NOW()
    WHERE debate_id = p_debate_id;
    
    -- If no transcript record exists yet, create one
    IF NOT FOUND THEN
        INSERT INTO public.transcripts (debate_id, user_id, full_text, created_at, updated_at)
        VALUES (p_debate_id, p_user_id, new_chunk, NOW(), NOW());
    END IF;
    
    RETURN next_line_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own profile" ON public.users FOR ALL USING (auth.uid() = id);

ALTER TABLE public.debate_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own debate setups" ON public.debate_setups FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own debates" ON public.debates FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage topics for their debates" ON public.topics FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage instructions for their debates" ON public.instructions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage transcripts for their debates" ON public.transcripts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.transcript_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage transcript lines for their debates" ON public.transcript_lines FOR ALL USING (auth.uid() = (SELECT user_id FROM public.debates WHERE id = debate_id));

ALTER TABLE public.debate_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their debate summaries" ON public.debate_summaries FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.analysis_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage analysis cards for their debates" ON public.analysis_cards FOR ALL USING (auth.uid() = user_id);

-- Allow service roles (i.e., Edge Functions) to manage the queue
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service roles to manage the queue" ON public.analysis_queue FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_cards, public.topics, public.transcript_lines;
