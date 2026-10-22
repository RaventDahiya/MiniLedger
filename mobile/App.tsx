import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
type Loan = { id: string; friendName: string; amountCents: number; dueDate: string; repaidAt: string | null };
type Summary = { totalLentCents: number; totalRepaidCents: number; overdueCents: number };

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalLentCents: 0, totalRepaidCents: 0, overdueCents: 0 });
  const [friendName, setFriendName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const refresh = useCallback(async (authToken: string) => {
    const [loanResponse, summaryResponse] = await Promise.all([
      request<{ loans: Loan[] }>("/loans", {}, authToken),
      request<Summary>("/summary", {}, authToken),
    ]);
    setLoans(loanResponse.loans);
    setSummary(summaryResponse);
  }, []);

  const showError = (error: unknown) => Alert.alert("Could not complete request", error instanceof Error ? error.message : "Please try again.");

  const requestCode = async () => {
    setBusy(true);
    try {
      await request("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone }) });
      setCodeRequested(true);
      Alert.alert("Code sent", "The mock OTP is printed in the API server log.");
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setBusy(true);
    try {
      const result = await request<{ token: string }>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, code: otp }) });
      setToken(result.token);
      await refresh(result.token);
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const addLoan = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await request("/loans", { method: "POST", body: JSON.stringify({ friendName, amount, dueDate }) }, token);
      setFriendName(""); setAmount(""); setDueDate("");
      await refresh(token);
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const repay = async (id: string) => {
    if (!token) return;
    try { await request(`/loans/${id}/repaid`, { method: "PATCH" }, token); await refresh(token); }
    catch (error) { showError(error); }
  };

  const isOverdue = useCallback((loan: Loan) => !loan.repaidAt && loan.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10), []);
  const header = useMemo(() => (
    <View>
      <Text style={styles.eyebrow}>YOUR MONEY, CLEARLY</Text>
      <Text style={styles.title}>MiniLedger</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.cardLabel}>TOTAL OUTSTANDING</Text>
        <Text style={styles.balance}>{money(summary.totalLentCents - summary.totalRepaidCents)}</Text>
        <View style={styles.summaryRow}>
          <View><Text style={styles.muted}>Lent</Text><Text style={styles.cardValue}>{money(summary.totalLentCents)}</Text></View>
          <View><Text style={styles.muted}>Repaid</Text><Text style={styles.cardValue}>{money(summary.totalRepaidCents)}</Text></View>
          <View><Text style={styles.muted}>Overdue</Text><Text style={[styles.cardValue, styles.warningText]}>{money(summary.overdueCents)}</Text></View>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Add a loan</Text>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Friend's name" value={friendName} onChangeText={setFriendName} />
        <TextInput style={styles.input} placeholder="Amount (e.g. 25.00)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} />
        <Pressable style={styles.primaryButton} onPress={addLoan} disabled={busy}><Text style={styles.primaryText}>Add loan</Text></Pressable>
      </View>
      <Text style={styles.sectionTitle}>Your loans</Text>
    </View>
  ), [amount, busy, dueDate, friendName, summary, token]);

  if (!token) return (
    <KeyboardAvoidingView style={styles.loginScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <Text style={styles.eyebrow}>A QUIET PLACE FOR LOANS</Text>
      <Text style={styles.title}>Keep friendship{`\n`}and money easy.</Text>
      <Text style={styles.subtitle}>Track what you lend, remember when it is due, and close the loop without awkwardness.</Text>
      <TextInput style={styles.input} placeholder="+1 415 555 2671" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {codeRequested && <TextInput style={styles.input} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />}
      <Pressable style={styles.primaryButton} onPress={codeRequested ? verifyCode : requestCode} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{codeRequested ? "Verify code" : "Send me a code"}</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={loans}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.empty}>No loans yet. Add your first one above.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.loan, isOverdue(item) && styles.overdueLoan]}>
            <View style={styles.loanMain}>
              <Text style={styles.friend}>{item.friendName}</Text>
              <Text style={styles.due}>{item.repaidAt ? "Repaid" : `Due ${item.dueDate.slice(0, 10)}`}</Text>
            </View>
            <View style={styles.loanAction}>
              <Text style={styles.amount}>{money(item.amountCents)}</Text>
              {!item.repaidAt && <Pressable onPress={() => repay(item.id)}><Text style={styles.repay}>Mark repaid</Text></Pressable>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f7f5f0" },
  content: { padding: 24, paddingBottom: 48 },
  loginScreen: { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#f7f5f0" },
  eyebrow: { color: "#8a6b4b", fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 12 },
  title: { color: "#1e2b25", fontSize: 42, fontWeight: "800", lineHeight: 45, letterSpacing: -1.2, marginBottom: 16 },
  subtitle: { color: "#68736d", fontSize: 16, lineHeight: 24, marginBottom: 28, maxWidth: 350 },
  summaryCard: { backgroundColor: "#244a3a", borderRadius: 24, padding: 22, marginBottom: 30 },
  cardLabel: { color: "#a8c5b0", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  balance: { color: "#fffdf7", fontSize: 37, fontWeight: "800", marginVertical: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", borderTopColor: "#416452", borderTopWidth: 1, paddingTop: 16 },
  muted: { color: "#a8c5b0", fontSize: 12, marginBottom: 4 },
  cardValue: { color: "#fffdf7", fontSize: 15, fontWeight: "700" },
  warningText: { color: "#f6c67d" },
  sectionTitle: { color: "#1e2b25", fontSize: 21, fontWeight: "800", marginBottom: 12 },
  form: { backgroundColor: "#fffdf7", borderRadius: 18, padding: 14, marginBottom: 30 },
  input: { backgroundColor: "#fffdf7", borderColor: "#dedbd2", borderWidth: 1, borderRadius: 12, color: "#1e2b25", fontSize: 16, padding: 15, marginBottom: 10 },
  primaryButton: { alignItems: "center", backgroundColor: "#d86742", borderRadius: 12, minHeight: 52, justifyContent: "center", paddingHorizontal: 20 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  loan: { alignItems: "center", backgroundColor: "#fffdf7", borderRadius: 16, flexDirection: "row", justifyContent: "space-between", marginBottom: 10, padding: 17 },
  overdueLoan: { borderColor: "#e4a15e", borderWidth: 2 },
  loanMain: { flex: 1 },
  friend: { color: "#1e2b25", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  due: { color: "#89918b", fontSize: 13 },
  loanAction: { alignItems: "flex-end" },
  amount: { color: "#1e2b25", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  repay: { color: "#d86742", fontSize: 12, fontWeight: "800" },
  empty: { color: "#89918b", fontSize: 15, paddingVertical: 10 },
});
