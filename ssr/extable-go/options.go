package extable

type Options struct {
	WrapWithRoot bool
	DefaultClass []string
	DefaultStyle map[string]string
}

type Result struct {
	HTML     string
	Metadata Metadata
}

type Metadata struct {
	RowCount    int
	ColumnCount int
	Warnings    []Warning
}

type Warning struct {
	RowIndex int
	ColKey   string
	Message  string
}
