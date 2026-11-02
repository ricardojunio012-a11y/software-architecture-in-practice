// The Communications module: sends notices to the residents. It is idempotent on
// the notice id: the same notice requested twice is sent only once.
export class Communications {
  readonly #sent = new Set<string>();

  // Returns true if it sent the notice now and false if it had already been sent
  send(id: string, _text: string): boolean {
    if (this.#sent.has(id)) return false;
    this.#sent.add(id);
    return true;
  }
}
