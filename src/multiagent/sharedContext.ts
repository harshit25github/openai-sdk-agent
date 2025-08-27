export class SharedContext {
  constructor() {
    this.data = {
      destination: null,
      dates: {
        start: null,
        end: null,
        duration: null
      },
      currentIntent: null
    };
  }

  update(updates) {
    this.data = { ...this.data, ...updates };
    console.log('Context updated:', JSON.stringify(this.data, null, 2));
  }

  get() {
    return this.data;
  }

  reset() {
    this.data = {
      destination: null,
      dates: {
        start: null,
        end: null,
        duration: null
      },
      currentIntent: null
    };
  }
}
