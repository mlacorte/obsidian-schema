export class Link {
  equals(_other: Link): boolean {
    return false;
  }
}

export class Widget {
  constructor(public $widget: string) {}

  markdown(): string {
    return this.$widget;
  }
}
