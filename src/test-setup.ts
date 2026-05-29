import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Dummy Supabase env so modules that construct the client at import time
// (`lib/supabase.ts`, pulled in transitively by the store) don't throw
// in the test environment. Tests never make real network calls.
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
