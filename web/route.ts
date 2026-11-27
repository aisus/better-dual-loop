// The page shown, from the URL's hash ("#/patcher"); no hash, or an unknown one, is the home page.
import { ref } from "vue";

export type Route = "home" | "patcher" | "drums" | "midi";

const ROUTES: Record<string, Route> = { "#/patcher": "patcher", "#/drums": "drums", "#/midi": "midi" };
const current = (): Route => ROUTES[location.hash] ?? "home";

export const route = ref(current());
addEventListener("hashchange", () => (route.value = current()));
