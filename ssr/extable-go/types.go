package extable

type ColumnType string

const (
	ColumnTypeString   ColumnType = "string"
	ColumnTypeNumber   ColumnType = "number"
	ColumnTypeInt      ColumnType = "int"
	ColumnTypeUint     ColumnType = "uint"
	ColumnTypeBoolean  ColumnType = "boolean"
	ColumnTypeDate     ColumnType = "date"
	ColumnTypeTime     ColumnType = "time"
	ColumnTypeDateTime ColumnType = "datetime"
	ColumnTypeEnum     ColumnType = "enum"
	ColumnTypeTags     ColumnType = "tags"
	ColumnTypeButton   ColumnType = "button"
	ColumnTypeLink     ColumnType = "link"
)

type Schema[T any] struct {
	Columns []Column[T]
}

type Column[T any] struct {
	Key      string
	Type     ColumnType
	Header   string
	Readonly bool
	Format   *Format
	Enum     *EnumSpec
	Tags     *TagsSpec
	Formula  func(T) any
	WrapText bool
}

type EnumSpec struct {
	Labels map[string]string
}

type TagsSpec struct {
	Separator string
}

type Format struct {
	BooleanTrue    string
	BooleanFalse   string
	NumberScale    *int
	DateLayout     string
	TimeLayout     string
	DateTimeLayout string
}
