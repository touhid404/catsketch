import { useEffect, useRef, useState } from 'react';
import {
  CallingState,
  CancelCallButton,
  DeviceSelectorAudioInput,
  DeviceSelectorAudioOutput,
  ParticipantsAudio,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  ToggleAudioPublishingButton,
  useCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { ArrowRight, ChevronLeft, Headphones, LoaderCircle, MicOff, Settings2 } from 'lucide-react';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import type { GuestSession } from '@syncspace/shared';
import { request } from '../../../lib/api-client';
type Credentials = {
  apiKey: string;
  token: string;
  callId: string;
  callType: string;
  user: { id: string; name: string };
};
export default function AudioCallPanel({
  session,
  connected,
  notify,
}: {
  session: GuestSession;
  connected: boolean;
  notify: (message: string) => void;
}) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [client, setClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();
  const [stage, setStage] = useState<'idle' | 'loading' | 'preview' | 'joining' | 'joined'>('idle');
  const notifications = useRef(notify);
  notifications.current = notify;
  const code = session.room.roomCode,
    token = session.token;
  useEffect(() => {
    if (!credentials) return;
    const tokenProvider = async () =>
      (await request<Credentials>(`/sessions/${code}/call-token`, {}, token)).token;
    const instance = new StreamVideoClient({
      apiKey: credentials.apiKey,
      user: credentials.user,
      tokenProvider,
    });
    setClient(instance);
    return () => {
      void instance.disconnectUser().catch(() => {});
      setClient(undefined);
    };
  }, [credentials, code, token]);
  useEffect(() => {
    if (!client || !credentials) return;
    const instance = client.call(credentials.callType, credentials.callId);
    instance.setDisconnectionTimeout(60);
    let active = true;
    void (async () => {
      try {
        await instance.get();
        await instance.camera.disable();
        await instance.microphone.disable();
        await instance.microphone.disableSpeakingWhileMutedNotification();
        if (active) {
          setCall(instance);
          setStage('preview');
        }
      } catch {
        if (active) {
          notifications.current(
            'The audio call could not connect. Check your network and try again.',
          );
          setCredentials(null);
          setStage('idle');
        }
      }
    })();
    return () => {
      active = false;
      void instance.leave().catch(() => {});
      setCall(undefined);
    };
  }, [client, credentials]);
  const close = () => {
    setCredentials(null);
    setStage('idle');
  };
  useEffect(() => {
    if (stage !== 'preview') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [stage]);
  const start = async () => {
    setStage('loading');
    try {
      setCredentials(await request<Credentials>(`/sessions/${code}/call-token`, {}, token));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not prepare the call.');
      setStage('idle');
    }
  };
  const join = async () => {
    if (!call) return;
    setStage('joining');
    try {
      await call.join({ create: false });
      setStage('joined');
    } catch {
      notify('Could not join the conversation. Check your network and try again.');
      setStage('preview');
    }
  };
  return (
    <>
      {stage !== 'joined' && (
        <div className="call-card">
          <div className="call-card-icon">
            <Headphones size={26} />
          </div>
          <h3>Give your ideas a voice.</h3>
          <p>
            Talk it through while you sketch it out.
            <br />
            Your whiteboard stays right here.
          </p>
          <button
            className="button button-dark"
            onClick={start}
            disabled={stage !== 'idle' || !connected}
          >
            {stage === 'loading' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Headphones size={16} />
            )}
            {stage === 'loading' ? 'Getting the call ready…' : 'Join audio call'}
          </button>
          <span className="call-card-caption">Join muted. Speak when you’re ready.</span>
        </div>
      )}
      {client && call && (
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <StreamTheme className="syncspace-call-theme">
              {stage === 'joined' ? (
                <div className="active-call">
                  <CallStatus />
                  <AudioParticipants />
                  <div className="stream-call-controls">
                    <MicrophoneControl notify={notify} />
                    <CancelCallButton
                      onLeave={(error) => {
                        if (error) notify('Your audio connection is closing.');
                        close();
                      }}
                    />
                  </div>
                  <AudioSettings />
                </div>
              ) : (
                <div className="modal-backdrop">
                  <section
                    className="call-prejoin"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Join audio call"
                  >
                    <button className="icon-button prejoin-back" onClick={close}>
                      <ChevronLeft size={18} /> Back to the board
                    </button>
                    <h2>Let’s talk it through.</h2>
                    <p>A shared conversation, with room for your ideas.</p>
                    <div className="audio-preview">
                      <GuestAvatar guestId={session.guest.guestId} name={session.guest.username} />
                      <strong>{session.guest.username}</strong>
                    </div>
                    <div className="preview-controls">
                      <MicrophoneControl notify={notify} />
                    </div>
                    <p className="device-permission-info">
                      Your microphone starts muted. Turn it on when you’re ready to speak.
                    </p>
                    <AudioSettings />
                    <button
                      className="button button-primary"
                      onClick={join}
                      disabled={stage === 'joining'}
                    >
                      {stage === 'joining' ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <ArrowRight size={17} />
                      )}
                      {stage === 'joining' ? 'Joining…' : 'Join the conversation'}
                    </button>
                  </section>
                </div>
              )}
            </StreamTheme>
          </StreamCall>
        </StreamVideo>
      )}
    </>
  );
}
function MicrophoneControl({ notify }: { notify: (message: string) => void }) {
  return (
    <ToggleAudioPublishingButton
      onError={() =>
        notify(
          'Microphone access is blocked or no microphone was found. Check your browser’s site settings.',
        )
      }
    />
  );
}
function AudioSettings() {
  const [open, setOpen] = useState(false);
  return (
    <div className="audio-settings">
      <button className="audio-settings-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Settings2 size={14} /> Audio settings
      </button>
      {open && (
        <div className="audio-device-selectors">
          <DeviceSelectorAudioInput visualType="dropdown" />
          <DeviceSelectorAudioOutput visualType="dropdown" />
        </div>
      )}
    </div>
  );
}
function AudioParticipants() {
  const { useParticipants, useRemoteParticipants } = useCallStateHooks();
  const participants = useParticipants(),
    remote = useRemoteParticipants();
  return (
    <>
      <ParticipantsAudio participants={remote} />
      <div className="audio-participants" aria-label="People in audio call">
        {participants.map((participant) => (
          <div
            key={participant.sessionId}
            className={`audio-person ${participant.isSpeaking ? 'is-speaking' : ''}`}
          >
            <GuestAvatar guestId={participant.userId} name={participant.name || 'Guest'} />
            <span>{participant.name || 'Guest'}</span>
            {!participant.publishedTracks.includes(1) && <MicOff size={12} aria-label="Muted" />}
          </div>
        ))}
      </div>
    </>
  );
}
function CallStatus() {
  const call = useCall();
  const { useCallCallingState, useIsAutoplayBlocked } = useCallStateHooks();
  const state = useCallCallingState(),
    blocked = useIsAutoplayBlocked();
  return (
    <>
      {state !== CallingState.JOINED && (
        <div className="call-status" role="status">
          {state === CallingState.LEFT
            ? 'You’ve left the conversation.'
            : 'Reconnecting to the conversation…'}
        </div>
      )}
      {blocked && (
        <button
          className="audio-unblock"
          onClick={() => {
            void call?.resumeAudio().catch(() => {});
          }}
        >
          Your browser paused audio. Click to hear the call.
        </button>
      )}
    </>
  );
}
