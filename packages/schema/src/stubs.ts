export class Link {
	equals(other: Link) {
		return false;
	}
}

export class Widget {
	constructor(public $widget: string) {}

	markdown() {
		return this.$widget;
	}
}