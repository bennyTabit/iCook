import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Colors } from "../constants/colors";

type Props = {
  children: React.ReactNode;
  /** Optional label shown in the error report (e.g. screen name) */
  context?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * React class-based error boundary.
 * Catches any JS error in the subtree and shows a friendly bilingual UI
 * instead of a white/blank screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this would go to Sentry / Firebase Crashlytics.
    console.error(
      `[ErrorBoundary] context="${this.props.context ?? "app"}"`,
      error,
      info.componentStack
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🍳</Text>

        <Text style={styles.titleHe}>משהו השתבש</Text>
        <Text style={styles.titleEn}>Something went wrong</Text>

        <Text style={styles.bodyHe}>
          אירעה שגיאה בלתי צפויה. אנחנו מצטערים!
        </Text>
        <Text style={styles.bodyEn}>
          An unexpected error occurred. Please try again.
        </Text>

        {__DEV__ && this.state.error && (
          <ScrollView style={styles.debugBox}>
            <Text style={styles.debugText}>
              {this.state.error.toString()}
            </Text>
          </ScrollView>
        )}

        <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>נסה שוב / Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  titleHe: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
  },
  titleEn: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 16,
  },
  bodyHe: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 4,
  },
  bodyEn: {
    fontSize: 13,
    color: Colors.text.tertiary,
    textAlign: "center",
    marginBottom: 24,
  },
  debugBox: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    maxHeight: 160,
    width: "100%",
    marginBottom: 24,
  },
  debugText: {
    fontSize: 11,
    color: Colors.primary,
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  buttonText: {
    color: Colors.text.inverse,
    fontSize: 15,
    fontWeight: "600",
  },
});
