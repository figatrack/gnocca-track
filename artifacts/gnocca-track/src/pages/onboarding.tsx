import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateUser } from "@workspace/api-client-react";
import { getDeviceId, setStoredUser } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import appIcon from "@/assets/app-icon.png";

type Step = "nickname" | "pin";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("nickname");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const createUser = useCreateUser();

  const handleNicknameNext = () => {
    if (nickname.trim().length < 2) {
      toast({ title: "Nickname troppo corto", description: "Minimo 2 caratteri" });
      return;
    }
    setStep("pin");
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    if (value && index < 3) {
      const next = document.getElementById(`pin-${index + 1}`);
      next?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-${index - 1}`);
      prev?.focus();
    }
  };

  const handleFinish = async () => {
    const fullPin = pin.join("");
    if (fullPin.length !== 4) {
      toast({ title: "PIN incompleto", description: "Inserisci 4 cifre" });
      return;
    }
    const deviceId = getDeviceId();
    try {
      await createUser.mutateAsync({
        data: { deviceId, nickname: nickname.trim(), pin: fullPin },
      });
      setStoredUser({ deviceId, nickname: nickname.trim() });
      navigate("/");
    } catch (err: unknown) {
      const anyErr = err as { status?: number; response?: { data?: { error?: string } } };
      if (anyErr?.status === 409) {
        const reason = anyErr?.response?.data?.error ?? "";
        if (reason === "Device already registered") {
          // Device already has an account — fetch it and log in
          try {
            const res = await fetch(`/api/users/${deviceId}`);
            if (res.ok) {
              const user = await res.json() as { nickname: string };
              setStoredUser({ deviceId, nickname: user.nickname });
              navigate("/");
              return;
            }
          } catch { /* fall through */ }
          toast({ title: "Profilo gia' esistente", description: "Torna alla home" });
          navigate("/");
        } else {
          toast({ title: "Nickname non disponibile", description: "Scegli un altro nickname" });
          setStep("nickname");
        }
      } else {
        toast({ title: "Errore", description: "Riprova tra poco" });
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12"
      style={{ paddingTop: "max(env(safe-area-inset-top), 48px)", paddingBottom: "max(env(safe-area-inset-bottom), 48px)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <img src={appIcon} alt="GnoccaTrack" className="w-28 h-28 object-cover rounded-[2rem] shadow-2xl" />

        {step === "nickname" ? (
          <div className="w-full flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Come ti chiamiamo?</h1>
              <p className="text-sm text-muted-foreground mt-2">Scegli un nickname per iniziare</p>
            </div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Il tuo nickname"
              maxLength={20}
              autoFocus
              className="w-full bg-card border border-border rounded-2xl px-5 py-4 text-lg font-medium text-center text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleNicknameNext()}
            />
            <button
              onClick={handleNicknameNext}
              className="w-full py-4 rounded-2xl text-lg font-bold text-white"
              style={{ background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)" }}
            >
              Continua
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Crea il tuo PIN segreto</h1>
              <p className="text-sm text-muted-foreground mt-2">4 cifre per proteggere il profilo</p>
            </div>
            <div className="flex justify-center gap-4">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  id={`pin-${i}`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className="w-16 h-16 text-center text-2xl font-bold bg-card border-2 border-border rounded-2xl text-foreground focus:outline-none focus:border-primary transition-colors"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <button
              onClick={handleFinish}
              disabled={createUser.isPending}
              className="w-full py-4 rounded-2xl text-lg font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)" }}
            >
              {createUser.isPending ? "Caricamento..." : "Inizia"}
            </button>
            <button
              onClick={() => setStep("nickname")}
              className="text-center text-sm text-muted-foreground"
            >
              Torna indietro
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Nessun dato personale richiesto. Tutto anonimo.
        </p>
      </div>
    </div>
  );
}
