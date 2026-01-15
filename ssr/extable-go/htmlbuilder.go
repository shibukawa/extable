package extable

import "strings"

type htmlBuilder struct {
	sb strings.Builder
}

func (b *htmlBuilder) openTag(tag string, attrs ...string) {
	b.sb.WriteString("<")
	b.sb.WriteString(tag)
	for i := 0; i+1 < len(attrs); i += 2 {
		key := attrs[i]
		value := attrs[i+1]
		if key == "" {
			continue
		}
		b.sb.WriteString(" ")
		b.sb.WriteString(key)
		b.sb.WriteString("=\"")
		b.sb.WriteString(escapeHTML(value))
		b.sb.WriteString("\"")
	}
	b.sb.WriteString(">")
}

func (b *htmlBuilder) closeTag(tag string) {
	b.sb.WriteString("</")
	b.sb.WriteString(tag)
	b.sb.WriteString(">")
}

func (b *htmlBuilder) text(text string) {
	b.sb.WriteString(escapeHTML(text))
}

func (b *htmlBuilder) raw(html string) {
	b.sb.WriteString(html)
}

func (b *htmlBuilder) string() string {
	return b.sb.String()
}
