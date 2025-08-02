import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// --- Custom Event Class to Mimic Threading Event ---
// This remains useful for signaling the audio processing loop to stop.
class CustomEvent {
    constructor() {
        this._isSet = false;
    }
    set() {
        this._isSet = true;
    }
    isSet() {
        return this._isSet;
    }
}

// --- Icon Components ---
const MicIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3a3 3 0 01-3 3z" /></svg>;
const StopIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6" /></svg>;
const BalanceIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3.52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-6.866-1.785m-2.875 0a5.988 5.988 0 01-6.866 1.785c-.483-.174-.711-.703-.59-1.202L9 4.971m-3.001-.47a48.417 48.417 0 00-3.001.52m3.001-.52L5.25 15.226c-.122.499.106 1.028.589 1.202a5.989 5.989 0 006.866-1.785m3.75 0a5.989 5.989 0 006.866 1.785c.483-.174-.711-.703.59-1.202L15 4.971m-4.5.472v.001" /></svg>;
const ArrowUpIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
const SparklesIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM18 13.5l.375 1.5L18 16.5l-.375-1.5-.375-1.5.375-1.5.375 1.5z" /></svg>;
const ShieldCheckIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" /></svg>;
const HandIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UserCircleIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const HomeIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>;
const ArrowLeftIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>;
const ExclamationTriangleIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
const MagnifyingGlassIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const Cog6ToothIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.48.398.668 1.03.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const LightBulbIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a7.5 7.5 0 01-7.5 0c-1.433-.47-2.7-1.151-3.75-2.006M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const StarIcon = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" /></svg>;

// --- Main App Component ---
const App = () => {
    const [session, setSession] = useState(null);
    const [currentPage, setCurrentPage] = useState('debate');
    const [selectedDebate, setSelectedDebate] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
        return () => subscription.unsubscribe();
    }, []);

    const viewAnalysis = (debate) => {
        setSelectedDebate(debate);
        setCurrentPage('analysis');
    };

    const Auth = () => {
        const [loading, setLoading] = useState(false);
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [isSignUp, setIsSignUp] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
                if (isSignUp) {
                    const { error } = await supabase.auth.signUp({ email, password });
                    if (error) throw error;
                    alert('Sign up successful! Please check your email for a verification link.');
                } else {
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                }
            } catch (error) {
                alert(error.error_description || error.message);
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl">
                    <h1 className="text-3xl font-bold text-center text-gray-800">{isSignUp ? 'Create an Account' : 'Welcome Back'}</h1>
                    <p className="text-center text-gray-600">{isSignUp ? 'Get started with your debate assistant.' : 'Sign in to continue.'}</p>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="text-sm font-bold text-gray-600 block">Email</label>
                            <input className="w-full mt-1 px-4 py-2 text-gray-700 bg-gray-100 border rounded-md focus:border-blue-500 focus:ring-blue-500 focus:outline-none focus:ring focus:ring-opacity-40" type="email" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-600 block">Password</label>
                            <input className="w-full mt-1 px-4 py-2 text-gray-700 bg-gray-100 border rounded-md focus:border-blue-500 focus:ring-blue-500 focus:outline-none focus:ring focus:ring-opacity-40" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" />
                        </div>
                        <div>
                            <button className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:bg-blue-700 disabled:bg-blue-400" disabled={loading}>{loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}</button>
                        </div>
                    </form>
                    <div className="text-center text-gray-600">
                        {isSignUp ? "Already have an account?" : "Don't have an account?"}
                        <button onClick={() => setIsSignUp(!isSignUp)} className="ml-2 text-blue-600 hover:underline font-semibold">{isSignUp ? 'Sign In' : 'Sign Up'}</button>
                    </div>
                </div>
            </div>
        );
    };

    if (!session) { return <Auth />; }

    return (
        <div className="h-screen w-full bg-gray-100">
            <nav className="bg-white shadow-md w-full p-2 flex items-center z-20">
                <h1 className="text-xl font-bold text-gray-800">Debate Assistant</h1>
                <div className="ml-auto flex gap-2">
                    <button onClick={() => setCurrentPage('debate')} className={`p-2 rounded-md flex items-center gap-2 ${currentPage === 'debate' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}><HomeIcon className="h-5 w-5" /> Debate</button>
                    <button onClick={() => setCurrentPage('setups')} className={`p-2 rounded-md flex items-center gap-2 ${currentPage === 'setups' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}><Cog6ToothIcon className="h-5 w-5" /> Setups</button>
                    <button onClick={() => setCurrentPage('profile')} className={`p-2 rounded-md flex items-center gap-2 ${currentPage === 'profile' || currentPage === 'analysis' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}><UserCircleIcon className="h-5 w-5" /> Profile</button>
                    <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-md hover:bg-gray-100 text-sm">Logout</button>
                </div>
            </nav>
            <main className="h-[calc(100%-52px)]">
                {currentPage === 'debate' && <DebatePage user={session.user} />}
                {currentPage === 'setups' && <SetupManagerPage user={session.user} />}
                {currentPage === 'profile' && <ProfilePage onViewAnalysis={viewAnalysis} user={session.user} />}
                {currentPage === 'analysis' && <AnalysisPage debate={selectedDebate} onBack={() => setCurrentPage('profile')} user={session.user} />}
            </main>
        </div>
    );
};

// --- DebatePage Component ---
const DebatePage = ({ user }) => {
    const [pageState, setPageState] = useState('setup');
    const [setups, setSetups] = useState([]);
    const [selectedSetupId, setSelectedSetupId] = useState('quick_start');
    const [liveDebate, setLiveDebate] = useState(null);
    const [liveFeedItems, setLiveFeedItems] = useState([]);
    const [activeSpeaker, setActiveSpeaker] = useState('user');
    const [activeFilter, setActiveFilter] = useState('all');
    const [topics, setTopics] = useState([]);
    const [transcriptLines, setTranscriptLines] = useState([]);
    const [selectedTopicId, setSelectedTopicId] = useState(null);
    const [isLoadingSetups, setIsLoadingSetups] = useState(true);
    const [showSetups, setShowSetups] = useState(false);
    const [debateTitle, setDebateTitle] = useState(`New Debate ${new Date().toLocaleDateString()}`);
    const [isRecording, setIsRecording] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    
    // Refs for audio processing and WebSocket
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const audioWorkletNodeRef = useRef(null);
    const audioStreamRef = useRef(null);
    
    const quickStartSetup = { id: 'quick_start', name: 'Quick Start', general_instructions: 'Listen for common logical fallacies and unsupported claims.', sources: [] };

    useEffect(() => {
        if (pageState === 'setup') {
            const fetchSetups = async () => {
                setIsLoadingSetups(true);
                const { data, error } = await supabase.from('debate_setups').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
                if (error) { console.error('Error fetching debate setups:', error); }
                else { setSetups([quickStartSetup, ...(data || [])]); }
                setIsLoadingSetups(false);
            };
            fetchSetups();
        }
    }, [pageState, user.id]);

    useEffect(() => {
        if (!liveDebate) return;
        const fetchInitialData = async () => {
            const { data: topicsData, error: topicsError } = await supabase.from('topics').select('*').eq('debate_id', liveDebate.id);
            if (topicsError) console.error('Error fetching topics:', topicsError); else setTopics(topicsData || []);
            // Corrected the select query to include the new 'speaker' column
            const { data: transcriptData, error: transcriptError } = await supabase.from('transcript_lines').select('line_number, text, speaker').eq('debate_id', liveDebate.id).order('line_number');
            if (transcriptError) console.error('Error fetching transcript lines:', transcriptError); else setTranscriptLines(transcriptData || []);
        };
        fetchInitialData();
        const handleCardChange = (payload) => {
            const newCard = payload.new;
            setLiveFeedItems(prevItems => {
                const cardExists = prevItems.some(item => item.id === newCard.id);
                if (cardExists) { return prevItems.map(item => item.id === newCard.id ? newCard : item); }
                else { return [...prevItems, newCard].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); }
            });
        };
        const analysisSubscription = supabase.channel(`analysis_cards_for_${liveDebate.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'analysis_cards', filter: `debate_id=eq.${liveDebate.id}` }, handleCardChange).subscribe();
        const topicSubscription = supabase.channel(`topics_for_${liveDebate.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'topics', filter: `debate_id=eq.${liveDebate.id}` }, fetchInitialData).subscribe();
        const transcriptSubscription = supabase.channel(`transcript_lines_for_${liveDebate.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcript_lines', filter: `debate_id=eq.${liveDebate.id}` }, (payload) => {
            setTranscriptLines(currentLines => [...currentLines, payload.new].sort((a, b) => a.line_number - b.line_number));
        }).subscribe();
        return () => { supabase.removeChannel(analysisSubscription); supabase.removeChannel(topicSubscription); supabase.removeChannel(transcriptSubscription); };
    }, [liveDebate]);

    const startTranscription = async () => {
        if (isRecording) return;
        setIsRecording(true);
        setInterimTranscript("Initializing...");

        try {
            // =================================================================
            // FIXED: Using the actual deployed Google Cloud Function URL
            // =================================================================
            const GCF_TOKEN_URL = 'https://us-west1-debate-assist-467621.cloudfunctions.net/getSpeechToken';
            
            console.log('[Auth] Fetching access token from Google Cloud Function...');
            const response = await fetch(GCF_TOKEN_URL, { method: 'POST' });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from GCF' }));
                throw new Error(`Failed to get access token from GCF: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            if (!data.access_token) {
                throw new Error('Access token not found in the response from GCF.');
            }
            const { access_token } = data;
            console.log('[Auth] Successfully fetched access token.');

            // Step 2: Connect directly to Google's WebSocket URL with the token.
            const googleWsUrl = `wss://speech.googleapis.com/v1p1beta1/speech:streamingrecognize?access_token=${access_token}`;
            console.log(`[Google] Connecting directly to WebSocket...`);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioContext;
            const sampleRate = audioContext.sampleRate;
            console.log(`[Audio] Context created with sample rate: ${sampleRate}`);

            // Load the audio processor worklet
            try {
                await audioContext.audioWorklet.addModule('audio-processor.js');
            } catch (e) {
                console.error('Error loading audio worklet:', e);
                alert('Failed to load audio processor. Please ensure audio-processor.js is in the public folder.');
                setIsRecording(false);
                return;
            }

            // This socket now connects directly to Google
            const socket = new WebSocket(googleWsUrl);
            socketRef.current = socket;
            
            socket.onopen = () => {
                console.log('[Google] WebSocket opened successfully.');
                
                // =================================================================
                // NEW: Simplified Speech API Configuration
                // =================================================================
                const configMessage = {
                    streaming_config: {
                        config: {
                            encoding: 'LINEAR16',
                            sample_rate_hertz: sampleRate,
                            language_code: 'en-US',
                            enable_automatic_punctuation: true,
                            // --- DEBUGGING STEP ---
                            // Speaker diarization is temporarily disabled to resolve the 400 error.
                            // Once the basic connection works, you can try re-enabling this.
                            // It's often the cause of handshake failures.
                            // enable_speaker_diarization: true,
                            // diarization_speaker_count: 2, // or min_speaker_count/max_speaker_count
                        },
                        interim_results: true,
                    },
                };

                socket.send(JSON.stringify(configMessage));
                setInterimTranscript("Listening...");

                // Start processing audio using the AudioWorklet
                const source = audioContext.createMediaStreamSource(stream);
                const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
                audioWorkletNodeRef.current = workletNode;

                workletNode.port.onmessage = (event) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(event.data);
                    }
                };

                source.connect(workletNode).connect(audioContext.destination);
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.error) {
                    console.error("[Google] Error message from upstream:", data.error);
                    alert(`Google API Error: ${data.error.message}. Please check console.`);
                    stopTranscription();
                    return;
                }
                
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    if (result.alternatives && result.alternatives.length > 0) {
                        const transcript = result.alternatives[0].transcript;
                        
                        if (result.is_final) {
                            setInterimTranscript(""); // Clear interim
                            
                            // Since diarization is off, we use the manually selected speaker.
                            const identifiedSpeaker = activeSpeaker; 

                            console.log(`[FINAL] Speaker (${identifiedSpeaker}): "${transcript}"`);
                            
                            // Send final transcript to our backend for processing
                            supabase.functions.invoke('transcription-service', {
                                body: {
                                    debate_id: liveDebate.id,
                                    speaker: identifiedSpeaker,
                                    transcript: transcript.trim(),
                                    user_id: user.id,
                                },
                            }).catch((err) => console.error('[DEBUG] Error invoking transcription-service:', err));
                        
                        } else {
                            setInterimTranscript(transcript);
                        }
                    }
                }
            };
            
            socket.onclose = (event) => {
                console.log(`[Google] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
                if (isRecording) {
                    stopTranscription();
                }
            };

            socket.onerror = (error) => {
                console.error('[Google] WebSocket error:', error);
                alert("A direct WebSocket error occurred with Google's service. See console for details.");
                if (isRecording) {
                    stopTranscription();
                }
            };

        } catch (err) {
            console.error('[FATAL] Error starting transcription:', err);
            if (err.name === 'NotAllowedError') {
                alert('Microphone access was denied. Please allow microphone permissions in your browser settings.');
            } else {
                alert(`Error starting transcription: ${err.message}`);
            }
            stopTranscription();
        }
    };

    const stopTranscription = async () => {
        if (!isRecording && !audioContextRef.current) return;
        console.log("[INFO] Stopping transcription...");
        setIsRecording(false);
        setInterimTranscript('');
        
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.close();
            socketRef.current = null;
        }

        if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.port.onmessage = null; // Remove listener
            audioWorkletNodeRef.current.disconnect();
            audioWorkletNodeRef.current = null;
        }
        
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };
    
    const toggleRecording = () => {
        if (isRecording) {
            stopTranscription();
        } else {
            startTranscription();
        }
    };

    const handleStartDebate = async () => {
        if (!selectedSetupId || !debateTitle.trim()) { alert("Please provide a title and select a setup."); return; }
        const selectedSetup = setups.find(s => s.id === selectedSetupId);
        if (!selectedSetup) { alert("Selected setup not found."); return; }
        const { data: debateData, error: debateError } = await supabase
            .from('debates')
            .insert({ title: debateTitle, user_id: user.id, setup_id: selectedSetup.id === 'quick_start' ? null : selectedSetup.id })
            .select().single();
        if (debateError) {
            console.error("[DEBUG] Error starting debate:", debateError);
            alert("Could not start debate.");
            return;
        }
        const sourcesPrompt = (selectedSetup.sources || []).map(s => `${s.source} (Topics: ${s.topics.join(', ')})`).join('\n');
        const primedTopics = [...new Set((selectedSetup.sources || []).flatMap(s => s.topics))];
        await supabase.from('instructions').insert({ debate_id: debateData.id, user_id: user.id, general_prompt: selectedSetup.general_instructions, sources_prompt: sourcesPrompt, primed_topics: primedTopics });
        setLiveDebate(debateData);
        setLiveFeedItems([]);
        setTopics([]);
        setTranscriptLines([]);
        setPageState('live');
    };

    const handleStopDebate = async () => {
        if (isRecording) {
            await stopTranscription();
        }
        setPageState('setup');
        setLiveDebate(null);
    };

    const highlightTranscript = (lineNumber) => {
        const lineElement = document.getElementById(`line-${lineNumber}`);
        if (lineElement) {
            lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lineElement.classList.add('bg-yellow-200', 'transition-all', 'duration-300');
            setTimeout(() => lineElement.classList.remove('bg-yellow-200'), 3000);
        }
    };

    const getFilteredFeed = () => {
        return liveFeedItems.filter(item => {
            if (item.speaker !== activeSpeaker) return false;
            if (selectedTopicId !== null && item.topic_id !== selectedTopicId) return false;
            // Filter by card type
            if (activeFilter !== 'all' && item.card_type !== activeFilter) {
                // Special case for fallacies
                if (activeFilter === 'fallacy' && (item.card_type === 'logical-fallacy' || item.card_type === 'bad-faith-argument')) {
                    return true;
                }
                return false;
            }
            return true;
        });
    };

    if (pageState === 'setup') {
        return (
            <div className="p-8 max-w-2xl mx-auto h-full overflow-y-auto">
                <div className="bg-white p-8 rounded-lg shadow-xl text-center">
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">Start a New Debate</h2>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="debate-title" className="block text-lg font-medium text-gray-700 mb-2">Debate Title</label>
                            <input id="debate-title" type="text" value={debateTitle} onChange={(e) => setDebateTitle(e.target.value)} placeholder="e.g., US Economic Policy Discussion" className="w-full p-3 border rounded-md shadow-sm text-center text-lg" />
                        </div>
                        <div className="border-t pt-6">
                            <button onClick={() => setShowSetups(!showSetups)} className="text-blue-600 hover:underline font-semibold">{showSetups ? 'Hide' : 'Show'} Advanced Setup Options</button>
                            <p className="text-sm text-gray-500 mt-2">Optionally, select a pre-configured setup. Defaults to "Quick Start".</p>
                        </div>
                        {showSetups && (
                            <div className="text-left mt-4 animate-fade-in">
                                <h3 className="font-bold text-gray-700 mb-3">Select a Setup:</h3>
                                {isLoadingSetups ? ( <div className="text-center text-gray-500">Loading setups...</div> ) : (
                                    <div className="space-y-3 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-md">
                                        {setups.map(setup => ( <div key={setup.id} onClick={() => setSelectedSetupId(setup.id)} className={`p-4 rounded-md cursor-pointer transition-all border-2 ${selectedSetupId === setup.id ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-white hover:bg-gray-100'}`} >
                                            <h4 className="font-bold text-gray-800">{setup.name}</h4>
                                            <p className="text-xs text-gray-600 line-clamp-2">{setup.general_instructions}</p>
                                        </div> ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="pt-6">
                            <button onClick={handleStartDebate} disabled={!selectedSetupId || isLoadingSetups || !debateTitle.trim()} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-full hover:bg-blue-700 transition-transform transform hover:scale-105 flex items-center gap-3 mx-auto disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none">
                                <MicIcon className="h-6 w-6" />Start Debate Session
                            </button>
                            <p className="mt-4 text-sm text-gray-500">You can create custom setups on the "Setups" page.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-full font-sans text-gray-800">
            <div className="w-full md:w-1/3 lg:w-1/4 p-4 flex flex-col bg-white shadow-md">
                <div className="flex justify-around items-center mb-6">
                    <button onClick={toggleRecording} className={`p-4 rounded-full text-white shadow-lg transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'} disabled:bg-gray-400`}>
                        {isRecording ? <StopIcon className="h-8 w-8" /> : <MicIcon className="h-8 w-8" />}
                    </button>
                    <button onClick={handleStopDebate} className="p-3 rounded-full text-white bg-gray-700 hover:bg-gray-800 shadow-lg text-sm font-bold">End Debate</button>
                </div>
                
                <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-bold text-gray-600 block mb-2 text-center">Live Transcription Status</p>
                     <div className="text-center my-2 p-3 bg-gray-100 rounded-md min-h-[60px] flex items-center justify-center">
                         <p className="font-mono text-gray-700 text-sm">
                              {interimTranscript || (isRecording ? "Listening..." : "Recording Paused")}
                         </p>
                     </div>
                    <p className="text-xs text-gray-500 text-center">
                        Powered by Google Speech-to-Text.
                    </p>
                </div>

                <div className="flex-grow overflow-y-auto mt-4">
                    {topics.length > 0 && ( <>
                        <h2 className="text-xl font-semibold mb-3">Live Topics</h2>
                        <ul>
                            <li onClick={() => setSelectedTopicId(null)} className={`p-3 rounded-md cursor-pointer mb-2 font-semibold transition-colors duration-200 ${selectedTopicId === null ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-blue-100'}`}>All Topics</li>
                            {topics.map(topic => ( <li key={topic.id} onClick={() => setSelectedTopicId(topic.id)} className={`p-3 rounded-md cursor-pointer mb-2 transition-colors duration-200 ${selectedTopicId === topic.id ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-blue-100'}`}>{topic.title}</li> ))}
                        </ul>
                    </>)}
                </div>
            </div>
            <div className="w-full md:w-2/3 lg:w-3/4 p-4 flex flex-col">
                <div className="flex-shrink-0 bg-white rounded-t-lg p-2 shadow z-10">
                    <div className="flex border-b border-gray-200">
                        <button onClick={() => setActiveSpeaker('user')} className={`flex-1 py-2 text-center font-semibold ${activeSpeaker === 'user' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>My Analysis & Coaching</button>
                        <button onClick={() => setActiveSpeaker('opponent')} className={`flex-1 py-2 text-center font-semibold ${activeSpeaker === 'opponent' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>Opponent's Analysis</button>
                    </div>
                     <p className="text-xs text-center text-gray-500 pt-1">Assign speaker using the tabs above before they talk.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <FilterButton label="Full Feed" filter="all" active={activeFilter} setter={setActiveFilter} />
                        <FilterButton label="Fact Checks" filter="verifiable-claim" active={activeFilter} setter={setActiveFilter} />
                        <FilterButton label="Fallacies" filter="fallacy" active={activeFilter} setter={setActiveFilter} />
                        <FilterButton label="Evasions" filter="evasion" active={activeFilter} setter={setActiveFilter} />
                    </div>
                </div>
                <div className="flex-grow flex flex-col space-y-4">
                    <div className="bg-gray-200 rounded-b-lg p-4 overflow-y-auto flex-grow">
                        {getFilteredFeed().length === 0 && (<div className="text-center text-gray-500 pt-10"><p>Awaiting analysis...</p></div>)}
                        {getFilteredFeed().map((item) => <UnifiedCard key={item.id} item={item} onClick={() => highlightTranscript(item.data.lineNumber)} />)}
                    </div>
                    <div className="mt-4 p-4 bg-white rounded-lg shadow-md overflow-y-auto h-1/3">
                        <h2 className="text-xl font-semibold mb-2">Live Transcript</h2>
                        <div>{transcriptLines.map(line => (<div key={line.line_number} id={`line-${line.line_number}`} className="text-sm text-gray-700 mb-1"><span className={`font-bold mr-2 ${line.speaker === 'user' ? 'text-blue-600' : 'text-red-600'}`}>{line.speaker}:</span> {line.text}</div>))}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Other components (SetupManagerPage, ProfilePage, etc.) remain unchanged for now.
// I'm including them here for completeness of the file.

const SetupManagerPage = ({ user }) => {
    const [setups, setSetups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [setupName, setSetupName] = useState('');
    const [generalInstructions, setGeneralInstructions] = useState("Watch for any mentions of the 2022 budget bill. Flag any ad hominem attacks.");
    const [sources, setSources] = useState([]);
    const [newSource, setNewSource] = useState('');
    const [newTopics, setNewTopics] = useState('');
    const [prioritizeSource, setPrioritizeSource] = useState(false);
    const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSetups = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('debate_setups').select('*').eq('user_id', user.id).order('created_at');
        if (error) console.error("Error fetching setups:", error);
        else setSetups(data || []);
        setIsLoading(false);
    };

    useEffect(() => { fetchSetups(); }, [user.id]);

    const handleAddSource = (e) => {
        e.preventDefault();
        if (!newSource) return;
        setSources(currentSources => [
            ...currentSources,
            {
                source: newSource,
                topics: newTopics.split(',').map(t => t.trim()).filter(Boolean),
                prioritize: prioritizeSource
            }
        ]);
        setNewSource('');
        setNewTopics('');
        setPrioritizeSource(false);
    };

    const handleGenerateTopics = async () => {
        if (!newSource) { alert("Please enter a source name or URL first."); return; }
        setIsGeneratingTopics(true);
        try {
            const { data, error } = await supabase.functions.invoke('source-analyzer', { body: { source_query: newSource } });
            if (error) throw error;
            setNewTopics(data.topics.join(', '));
        } catch (error) {
            console.error("Error generating topics:", error);
            alert("Could not generate topics from the source.");
        } finally {
            setIsGeneratingTopics(false);
        }
    };

    const handleSaveSetup = async () => {
        if (!setupName) { alert("Please provide a name for this setup."); return; }
        setIsSaving(true);
        const { error } = await supabase.from('debate_setups').insert({ user_id: user.id, name: setupName, general_instructions: generalInstructions, sources: sources });
        if (error) {
            alert("Error saving setup: " + error.message);
        } else {
            alert("Setup saved successfully!");
            setSetupName('');
            setGeneralInstructions('');
            setSources([]);
            fetchSetups();
        }
        setIsSaving(false);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Debate Setup Manager</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                    <h3 className="text-2xl font-bold text-gray-800">Create New Setup</h3>
                    <div> <label htmlFor="setup-name" className="block text-lg font-medium text-gray-700 mb-2">Setup Name</label> <input id="setup-name" type="text" value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="e.g., Economic Policy Setup" className="w-full p-2 border rounded-md shadow-sm" /> </div>
                    <div> <label htmlFor="general-instructions" className="block text-lg font-medium text-gray-700 mb-2">AI Instructions & Watchlist</label> <textarea id="general-instructions" rows="4" className="w-full p-2 border rounded-md shadow-sm" placeholder="e.g., Watch for mentions of 'fiscal responsibility'." value={generalInstructions} onChange={(e) => setGeneralInstructions(e.target.value)} /> </div>
                    <div>
                        <label className="block text-lg font-medium text-gray-700 mb-2">Preferred Sources & Topics</label>
                        <form onSubmit={handleAddSource} className="bg-gray-50 p-4 rounded-lg space-y-3">
                            <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="Source Name or URL (e.g., IPCC report)" className="w-full p-2 border rounded-md" />
                            <div className="flex items-center gap-2">
                                <input type="text" value={newTopics} onChange={(e) => setNewTopics(e.target.value)} placeholder="Add topics (comma-separated)..." className="w-full p-2 border rounded-md" />
                                <button type="button" onClick={handleGenerateTopics} disabled={isGeneratingTopics} className="text-sm bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 whitespace-nowrap disabled:opacity-50">{isGeneratingTopics ? 'Analyzing...' : 'Analyze'}</button>
                            </div>
                            <div className="flex items-center">
                                <input id="prioritize-source" type="checkbox" checked={prioritizeSource} onChange={(e) => setPrioritizeSource(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <label htmlFor="prioritize-source" className="ml-2 block text-sm text-gray-900">Prioritize this source as primary truth</label>
                            </div>
                            <button type="submit" className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add Source & Topics</button>
                        </form>
                        <div className="mt-4 space-y-2">
                            {sources.map((s, index) => (
                                <div key={index} className="bg-white p-3 border rounded-md flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center">
                                            {s.prioritize && <StarIcon className="h-5 w-5 text-yellow-400 mr-2" />}
                                            <p className="font-semibold text-gray-800">{s.source}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1 pl-7">
                                            {s.topics.map(t => <span key={t} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{t}</span>)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-center pt-4"> <button onClick={handleSaveSetup} disabled={isSaving} className="w-full bg-green-600 text-white font-bold py-3 px-8 rounded-md hover:bg-green-700 disabled:bg-green-400">{isSaving ? 'Saving...' : 'Save New Setup'}</button> </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-gray-800">My Saved Setups</h3>
                    {isLoading ? ( <p>Loading...</p> ) : setups.length === 0 ? ( <p className="text-gray-600">You haven't created any setups yet.</p> ) : (
                        <div className="space-y-4 h-[calc(100vh-250px)] overflow-y-auto pr-2">
                            {setups.map(setup => (
                                <div key={setup.id} className="bg-white p-4 rounded-lg shadow">
                                    <h4 className="font-bold text-lg text-blue-700">{setup.name}</h4>
                                    <p className="text-sm text-gray-600 mt-1 mb-3">{setup.general_instructions}</p>
                                    {(setup.sources || []).length > 0 && (
                                        <div className="border-t pt-3 mt-3 space-y-3">
                                            <h5 className="font-semibold text-sm text-gray-700">Preferred Sources:</h5>
                                            {setup.sources.map((source, index) => (
                                                <div key={index} className="text-sm">
                                                    <div className="flex items-center">
                                                        {source.prioritize && <StarIcon className="h-4 w-4 text-yellow-400 mr-2" />}
                                                        <p className="font-medium text-gray-900">{source.source}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1 pl-6">
                                                        {source.topics.map(topic => ( <span key={topic} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-xs">{topic}</span> ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProfilePage = ({ onViewAnalysis, user }) => {
    const [debateHistory, setDebateHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDebateHistory = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('debates').select(`id, title, created_at, topics (id, title), analysis_cards (id, speaker, data, card_type), debate_summaries (*)`).eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) { console.error("Error fetching debate history:", error); }
            else { setDebateHistory(data || []); }
            setLoading(false);
        };
        fetchDebateHistory();
    }, [user.id]);

    if (loading) { return <div className="text-center p-10">Loading debate history...</div>; }

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Debate History</h2>
            <div className="space-y-6">
                {debateHistory.length === 0 && <p>No debates found. Go to the Debate page to start one!</p>}
                {debateHistory.map(debate => (<DebateHistoryCard key={debate.id} debate={debate} onViewAnalysis={onViewAnalysis} />))}
            </div>
        </div>
    );
};

const AnalysisPage = ({ debate, onBack }) => {
    const [activeTab, setActiveTab] = useState('analysis');
    const [selectedTopics, setSelectedTopics] = useState(['all']);
    const [transcriptLines, setTranscriptLines] = useState([]);

    useEffect(() => {
        const fetchTranscriptLines = async () => {
            const { data, error } = await supabase.from('transcript_lines').select('line_number, text').eq('debate_id', debate.id).order('line_number');
            if (error) console.error('Error fetching transcript lines:', error);
            else setTranscriptLines(data || []);
        };
        fetchTranscriptLines();
    }, [debate.id]);

    const userFallacies = debate.analysis_cards.filter(c => c.speaker === 'user' && c.card_type === 'logical-fallacy').length;
    const opponentFallacies = debate.analysis_cards.filter(c => c.speaker === 'opponent' && c.card_type === 'logical-fallacy').length;
    const userEvasions = debate.analysis_cards.filter(c => c.speaker === 'user' && c.card_type === 'evasion').length;
    const opponentEvasions = debate.analysis_cards.filter(c => c.speaker === 'opponent' && c.card_type === 'evasion').length;

    const handleTopicToggle = (topicId) => {
        if (topicId === 'all') { setSelectedTopics(['all']); }
        else {
            const newTopics = selectedTopics.includes('all') ? [] : [...selectedTopics];
            const index = newTopics.indexOf(topicId);
            if (index > -1) { newTopics.splice(index, 1); }
            else { newTopics.push(topicId); }
            if (newTopics.length === 0) { setSelectedTopics(['all']); }
            else { setSelectedTopics(newTopics); }
        }
    };

    const getFilteredAnalysis = () => {
        let filtered = activeTab === 'analysis' ? debate.analysis_cards : debate.analysis_cards.filter(c => c.speaker === activeTab);
        if (selectedTopics.includes('all')) return filtered;
        return filtered.filter(c => selectedTopics.includes(c.topic_id));
    };

    const highlightTranscript = (lineNumber) => {
        const lineElement = document.getElementById(`line-${lineNumber}`);
        if (lineElement) {
            lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lineElement.classList.add('bg-yellow-200');
            setTimeout(() => lineElement.classList.remove('bg-yellow-200'), 3000);
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto">
            <button onClick={onBack} className="flex items-center gap-2 text-blue-600 font-semibold mb-4 hover:underline"><ArrowLeftIcon className="h-5 w-5" />Back to Profile</button>
            <h2 className="text-3xl font-bold text-gray-800">{debate.title}</h2> <p className="text-md text-gray-500 mb-6">{new Date(debate.created_at).toLocaleDateString()}</p>
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-bold mb-4">Performance Snapshot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <SnapshotCard title="Logical Fallacies" userScore={userFallacies} opponentScore={opponentFallacies} />
                    <SnapshotCard title="Argument Evasions" userScore={userEvasions} opponentScore={opponentEvasions} />
                    <SnapshotCard title="Argument Strength" userScore={debate.debate_summaries?.user_strength_score ?? 'N/A'} opponentScore={debate.debate_summaries?.opponent_strength_score ?? 'N/A'} />
                    <SnapshotCard title="Source Accuracy" userScore={debate.debate_summaries?.user_accuracy_score ?? 'N/A'} opponentScore={debate.debate_summaries?.opponent_accuracy_score ?? 'N/A'} />
                </div>
            </div>
            {debate.debate_summaries && <div className="bg-white p-6 rounded-lg shadow-md mb-8"> <h3 className="text-2xl font-bold mb-4">Debate Summary</h3> <div className="space-y-4"> <div> <h4 className="font-semibold text-lg">Your Main Arguments</h4> <p className="text-gray-700">{debate.debate_summaries.user_summary}</p> </div> <div> <h4 className="font-semibold text-lg">Opponent's Main Arguments</h4> <p className="text-gray-700">{debate.debate_summaries.opponent_summary}</p> </div> </div> </div>}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-bold mb-4">Analysis Breakdown</h3>
                <div className="mb-4 pb-4 border-b"> <h4 className="font-semibold mb-2">Filter by Topic:</h4> <div className="flex flex-wrap gap-2"> <TopicFilterButton label="All Topics" topicId="all" selectedTopics={selectedTopics} onToggle={handleTopicToggle} /> {debate.topics.map(topic => (<TopicFilterButton key={topic.id} label={topic.title} topicId={topic.id} selectedTopics={selectedTopics} onToggle={handleTopicToggle} />))} </div> </div>
                <div className="flex border-b mb-4"> <AnalysisTabButton label="All Analysis" tabName="analysis" activeTab={activeTab} setActiveTab={setActiveTab} /> <AnalysisTabButton label="My Performance" tabName="user" activeTab={activeTab} setActiveTab={setActiveTab} /> <AnalysisTabButton label="Opponent's Performance" tabName="opponent" activeTab={activeTab} setActiveTab={setActiveTab} /> </div>
                <div className="space-y-4"> {getFilteredAnalysis().map((item) => <UnifiedCard key={item.id} item={item} onClick={() => highlightTranscript(item.data.lineNumber)} />)} </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md"> <h3 className="text-2xl font-bold mb-4">Full Transcript</h3> <div className="overflow-y-auto max-h-96"> {transcriptLines.map(line => (<div key={line.line_number} id={`line-${line.line_number}`} className="text-sm text-gray-700 mb-1"><span className="font-mono text-gray-500 mr-2">{line.line_number}:</span> {line.text}</div>))} </div> </div>
        </div>
    );
};

const SnapshotCard = ({ title, userScore, opponentScore }) => (<div className="bg-gray-100 p-4 rounded-lg"><h4 className="font-bold text-md h-12">{title}</h4><p className="text-3xl font-bold"><span className="text-blue-600">{userScore}</span><span className="text-lg text-gray-500 mx-1">vs</span><span className="text-red-600">{opponentScore}</span></p><p className="text-sm text-gray-600">(You vs Opponent)</p></div>);
const AnalysisTabButton = ({ label, tabName, activeTab, setActiveTab }) => (<button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 font-semibold text-sm ${activeTab === tabName ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>{label}</button>);
const TopicFilterButton = ({ label, topicId, selectedTopics, onToggle }) => { const isSelected = selectedTopics.includes(topicId); return (<button onClick={() => onToggle(topicId)} className={`px-3 py-1 text-sm rounded-full font-semibold transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{label}</button>); };
const DebateHistoryCard = ({ debate, onViewAnalysis }) => (<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"><h3 className="text-xl font-bold text-blue-600">{debate.title}</h3><p className="text-sm text-gray-500 mb-3">{new Date(debate.created_at).toLocaleDateString()}</p><div className="mb-4"><h4 className="font-semibold mb-2">Key Topics:</h4><div className="flex flex-wrap gap-2">{debate.topics.map(topic => (<span key={topic.id} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm">{topic.title}</span>))}</div></div><button onClick={() => onViewAnalysis(debate)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">View Analysis</button></div>);
const FilterButton = ({ label, filter, active, setter }) => (<button onClick={() => setter(filter)} className={`px-2 py-1 text-xs sm:text-sm rounded-full font-semibold transition-colors w-full ${active === filter ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{label}</button>);

const FactCheckSection = ({ factCheck }) => {
    if (!factCheck || !factCheck.claims || factCheck.claims.length === 0) return null;
    return (
        <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-gray-600 flex items-center mb-2"><BalanceIcon className="h-5 w-5 mr-2" />Fact Check Analysis</h4>
            <div className="text-sm space-y-3 text-gray-800">
                {factCheck.claims.map((claim, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded-md">
                        <p><strong>Claim:</strong> {claim.claim}</p>
                        <p><strong>Finding:</strong> <span className="font-semibold">{claim.finding}</span></p>
                        <p><strong>Evidence:</strong> {claim.evidence}</p>
                    </div>
                ))}
                {factCheck.assumptions && factCheck.assumptions.length > 0 && (
                    <div className="p-2 bg-gray-50 rounded-md">
                        <strong>Assumptions:</strong>
                        <ul className="list-disc list-inside">
                            {factCheck.assumptions.map((assumption, index) => ( <li key={index}>{assumption}</li> ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

const CoachingSection = ({ coaching }) => {
    if (!coaching || Object.keys(coaching).length === 0) return null;
    const coachingInfo = {
        'counter-argument': { icon: <ArrowUpIcon className="h-5 w-5" />, title: 'Counter Argument', color: 'cyan' },
        'self-correction': { icon: <SparklesIcon className="h-5 w-5" />, title: 'Self-Correction', color: 'purple' },
        'steelman': { icon: <ShieldCheckIcon className="h-5 w-5" />, title: 'Strengthen Argument (Steelman)', color: 'green' },
        'concession': { icon: <HandIcon className="h-5 w-5" />, title: 'Concession & Pivot', color: 'orange' },
    };
    return (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <h4 className="font-semibold text-gray-600 flex items-center"><LightBulbIcon className="h-5 w-5 mr-2" />Coaching Suggestions</h4>
            {Object.entries(coaching).map(([key, value]) => {
                const info = coachingInfo[key] || { icon: <LightBulbIcon className="h-5 w-5" />, title: 'Suggestion', color: 'gray' };
                return (
                    <div key={key} className={`p-3 bg-${info.color}-50 border-l-4 border-${info.color}-400 rounded-r-md`}>
                        <h5 className={`font-semibold text-${info.color}-700 flex items-center mb-1`}>{info.icon} <span className="ml-2">{info.title}</span></h5>
                        <p className="text-sm font-medium text-gray-800">{value.suggestion}</p>
                        {value.rationale && <p className="text-xs text-gray-500 italic mt-1">{value.rationale}</p>}
                    </div>
                );
            })}
        </div>
    );
};

const UnifiedCard = ({ item, onClick }) => {
    const { card_type, data } = item;
    const cardStyles = {
        'logical-fallacy': { color: 'border-red-500' },
        'evasion': { color: 'border-yellow-500' },
        'bad-faith-argument': { color: 'border-orange-600' },
        'custom-finding': { color: 'border-gray-500' },
        'verifiable-claim': { color: 'border-blue-500' },
    };
    const style = cardStyles[card_type] || cardStyles['custom-finding'];
    const renderAnalysisContent = () => {
        if (!data.analysis) return null;
        switch (card_type) {
            case 'logical-fallacy':
            case 'bad-faith-argument':
            case 'custom-finding':
            case 'verifiable-claim':
                return <p><span className="font-bold">{data.analysis.name}:</span> {data.analysis.explanation}</p>;
            case 'evasion':
                return (<div className="space-y-2">
                    <div><p className="font-semibold text-gray-600">Inferred Question:</p><p className="italic">"{data.analysis.question}"</p></div>
                    <div><p className="font-semibold text-gray-600">Explanation:</p><p>{data.analysis.explanation}</p></div>
                </div>);
            default:
                return <p>Analysis data present but no specific view configured.</p>
        }
    };
    return (
        <div onClick={onClick} className={`cursor-pointer bg-white rounded-lg shadow-md border-l-4 ${style.color} p-4 animate-fade-in mb-4`}>
            <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>Topic: <span className="font-semibold">{data.topicTitle || 'General'}</span></span>
                <span>Line: {data.lineNumber}</span>
            </div>
            {data.transcriptSnippet && <p className="text-sm text-gray-500 italic mb-2 border-y py-2">"{data.transcriptSnippet}"</p>}
            <div className="pl-2 text-gray-700">
                {data.status === 'analyzing' && <div className="text-center text-gray-500 py-4">Analyzing...</div>}
                {data.status === 'invalid_trigger' && <div className="text-center text-gray-500 py-4">Trigger dismissed after analysis.</div>}
                {(data.status === 'complete' || data.status === 'failed_coaching' || data.analysis) && renderAnalysisContent()}
                <FactCheckSection factCheck={data.fact_check} />
                <CoachingSection coaching={data.coaching} />
            </div>
        </div>
    );
};

export default App;
