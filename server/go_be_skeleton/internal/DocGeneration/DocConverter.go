package docgeneration

import (
	"bytes"
	"strings"

	"github.com/gomutex/godocx/docx"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// ConvertMarkdownToDocx parses raw Markdown text and applies formatting to a godocx Document

func addList(list *ast.List, source []byte, doc *docx.RootDoc, depth int) {
	for item := list.FirstChild(); item != nil; item = item.NextSibling() {
		li, ok := item.(*ast.ListItem)
		if !ok {
			continue
		}

		p := doc.AddParagraph("")
		if list.IsOrdered() {
			p.Style("List Number")
		} else {
			p.Style("List Bullet")
		}
		if depth > 0 {
			p.AddText(strings.Repeat("    ", depth)) // crude indent, see note
		}

		for c := li.FirstChild(); c != nil; c = c.NextSibling() {
			switch child := c.(type) {
			case *ast.TextBlock, *ast.Paragraph: // tight vs loose list
				parseInlineFormatting(child, source, p)
			case *ast.List: // nested sub-list
				addList(child, source, doc, depth+1)
			}
		}
	}
}

func ConvertMarkdownToDocx(mdContent string, doc *docx.RootDoc) error {
	md := goldmark.New()
	source := []byte(mdContent)
	reader := text.NewReader(source)
	docNode := md.Parser().Parse(reader)

	// Traverse the Markdown AST tree
	for n := docNode.FirstChild(); n != nil; n = n.NextSibling() {
		switch node := n.(type) {

		case *ast.Heading:
			// Extract plain text from heading
			headingText := extractText(node, source)
			doc.AddHeading(headingText, uint(node.Level))

		case *ast.Paragraph:
			// Create a new paragraph and parse inline formatting (bold, italic, plain text)
			p := doc.AddParagraph("")
			parseInlineFormatting(node, source, p)

		case *ast.List:
			addList(node, source, doc, 0)
		}
	}
	return nil
}

// Helper to handle inline elements like **bold**, *italic*, and plain text
func parseInlineFormatting(parent ast.Node, source []byte, p *docx.Paragraph) {
	for child := parent.FirstChild(); child != nil; child = child.NextSibling() {
		switch n := child.(type) {
		case *ast.Text:
			txt := string(n.Segment.Value(source))
			p.AddText(txt)
		case *ast.Emphasis:
			txt := extractText(n, source)
			t := p.AddText(txt)
			if n.Level == 2 {
				t.Bold(true) // **bold**
			} else if n.Level == 1 {
				t.Italic(true) // *italic*
			}
		}
	}
}

// Helper to extract text from AST nodes
func extractText(n ast.Node, source []byte) string {
	var buf bytes.Buffer
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		if t, ok := c.(*ast.Text); ok {
			buf.Write(t.Segment.Value(source))
		} else {
			buf.WriteString(extractText(c, source))
		}
	}
	return buf.String()
}
