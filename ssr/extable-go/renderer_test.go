package extable

import (
	"regexp"
	"strings"
	"testing"
)

type sampleRow struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

type formulaRow struct {
	Name string `json:"name"`
}

func TestRenderTableBasic(t *testing.T) {
	result, err := RenderTableHTML(
		[]sampleRow{{Name: "Alice", Age: 30}},
		Schema[sampleRow]{Columns: []Column[sampleRow]{
			{Key: "name", Type: ColumnTypeString, Header: "Name"},
			{Key: "age", Type: ColumnTypeInt, Header: "Age"},
		}},
		Options{},
	)
	if err != nil {
		t.Fatalf("render failed: %v", err)
	}
	if !strings.Contains(result.HTML, "data-col-key=\"name\"") {
		t.Fatalf("expected data-col-key for name")
	}
	if !strings.Contains(result.HTML, "data-col-key=\"age\"") {
		t.Fatalf("expected data-col-key for age")
	}
	if !strings.Contains(result.HTML, "Alice") {
		t.Fatalf("expected cell content")
	}
	if !strings.Contains(result.HTML, "30") {
		t.Fatalf("expected numeric cell content")
	}

	attrPattern := regexp.MustCompile(`data-[a-z0-9-]+=`)
	matches := attrPattern.FindAllString(result.HTML, -1)
	for _, match := range matches {
		if match != "data-col-key=" {
			t.Fatalf("unexpected data attribute: %s", match)
		}
	}
}

func TestRenderWrapWithRoot(t *testing.T) {
	result, err := RenderTableHTML(
		[]sampleRow{{Name: "Alice", Age: 30}},
		Schema[sampleRow]{Columns: []Column[sampleRow]{
			{Key: "name", Type: ColumnTypeString},
		}},
		Options{
			WrapWithRoot: true,
			DefaultClass: []string{"demo-root"},
			DefaultStyle: map[string]string{"height": "300px"},
		},
	)
	if err != nil {
		t.Fatalf("render failed: %v", err)
	}
	if !strings.Contains(result.HTML, "extable-root") {
		t.Fatalf("expected root wrapper")
	}
	if !strings.Contains(result.HTML, "extable-shell") {
		t.Fatalf("expected shell wrapper")
	}
	if !strings.Contains(result.HTML, "extable-viewport") {
		t.Fatalf("expected viewport wrapper")
	}
	if !strings.Contains(result.HTML, "extable-overlay-layer") {
		t.Fatalf("expected overlay layer")
	}
	if !strings.Contains(result.HTML, "demo-root") {
		t.Fatalf("expected default class")
	}
	if !strings.Contains(result.HTML, "height: 300px") {
		t.Fatalf("expected default style")
	}
}

func TestRenderEscapesValues(t *testing.T) {
	result, err := RenderTableHTML(
		[]sampleRow{{Name: "<script>", Age: 10}},
		Schema[sampleRow]{Columns: []Column[sampleRow]{
			{Key: "name", Type: ColumnTypeString},
		}},
		Options{},
	)
	if err != nil {
		t.Fatalf("render failed: %v", err)
	}
	if strings.Contains(result.HTML, "<script>") {
		t.Fatalf("expected escaped HTML")
	}
	if !strings.Contains(result.HTML, "&lt;script&gt;") {
		t.Fatalf("expected escaped value")
	}
}

func TestFormulaMissingWarning(t *testing.T) {
	result, err := RenderTableHTML(
		[]formulaRow{{Name: "Alice"}},
		Schema[formulaRow]{Columns: []Column[formulaRow]{
			{Key: "name", Type: ColumnTypeString},
			{Key: "score", Type: ColumnTypeNumber, Formula: func(row formulaRow) any { return nil }},
		}},
		Options{},
	)
	if err != nil {
		t.Fatalf("render failed: %v", err)
	}
	if len(result.Metadata.Warnings) != 1 {
		t.Fatalf("expected warning")
	}
	if result.Metadata.Warnings[0].ColKey != "score" {
		t.Fatalf("unexpected warning col: %s", result.Metadata.Warnings[0].ColKey)
	}
}
