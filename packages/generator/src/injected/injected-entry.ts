// IIFE bundle entry — evaluated in the target page via addInitScript. Installs
// the in-page recorder on every document (initial load and each navigation).
import { installRecorder } from './recorder';

installRecorder();
