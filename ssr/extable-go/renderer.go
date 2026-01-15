package extable

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
)

func RenderTableHTML[T any](data []T, schema Schema[T], opts Options) (Result, error) {
	columns := schema.Columns
	getter, err := newFieldGetter[T]()
	if err != nil {
		return Result{}, err
	}

	builder := &htmlBuilder{}

	if opts.WrapWithRoot {
		rootClass := append([]string{"extable-root"}, opts.DefaultClass...)
		rootAttrs := []string{"class", strings.Join(rootClass, " ")}
		if len(opts.DefaultStyle) > 0 {
			rootAttrs = append(rootAttrs, "style", styleString(opts.DefaultStyle))
		}
		builder.openTag("div", rootAttrs...)
		builder.openTag("div", "class", "extable-shell")
		builder.openTag("div", "class", "extable-viewport")
	}

	builder.openTag("table")
	builder.openTag("thead")
	builder.openTag("tr")
	builder.openTag("th", "class", "extable-row-header extable-corner", "data-col-key", "")
	builder.closeTag("th")
	for _, col := range columns {
		builder.openTag("th", "data-col-key", col.Key)
		builder.openTag("div", "class", "extable-col-header")
		builder.openTag("span", "class", "extable-col-header-text")
		builder.text(columnHeader(col))
		builder.closeTag("span")
		builder.closeTag("div")
		builder.closeTag("th")
	}
	builder.closeTag("tr")
	builder.closeTag("thead")
	builder.openTag("tbody")

	warnings := make([]Warning, 0)
	for rowIndex, row := range data {
		builder.openTag("tr")
		builder.openTag("th", "class", "extable-row-header", "scope", "row")
		builder.text(strconv.Itoa(rowIndex + 1))
		builder.closeTag("th")

		rowReadonly := getter.rowReadonly(row)

		for _, col := range columns {
			value, ok := getter.valueForKey(row, col.Key)
			if col.Formula != nil && !ok {
				warnings = append(warnings, Warning{
					RowIndex: rowIndex,
					ColKey:   col.Key,
					Message:  "formula value missing",
				})
			}

			classes := []string{"extable-cell"}
			if col.Type == ColumnTypeBoolean {
				classes = append(classes, "extable-boolean")
			}
			if col.WrapText {
				classes = append(classes, "cell-wrap")
			} else {
				classes = append(classes, "cell-nowrap")
			}
			if isRightAligned(col.Type) {
				classes = append(classes, "align-right")
			} else {
				classes = append(classes, "align-left")
			}
			if col.Readonly || col.Formula != nil || rowReadonly {
				classes = append(classes, "extable-readonly")
				if col.Formula != nil {
					classes = append(classes, "extable-readonly-formula")
				}
			} else {
				classes = append(classes, "extable-editable")
			}

			builder.openTag("td", "class", strings.Join(classes, " "), "data-col-key", col.Key)

			text := formatValue(value, col)
			if col.Type == ColumnTypeButton {
				builder.openTag("button", "class", "extable-action-button", "type", "button")
				builder.text(text)
				builder.closeTag("button")
			} else if col.Type == ColumnTypeLink {
				builder.openTag("span", "class", "extable-action-link")
				builder.text(text)
				builder.closeTag("span")
			} else {
				builder.text(text)
			}

			builder.closeTag("td")
		}
		builder.closeTag("tr")
	}

	builder.closeTag("tbody")
	builder.closeTag("table")

	if opts.WrapWithRoot {
		builder.closeTag("div")
		builder.openTag("div", "class", "extable-overlay-layer")
		builder.closeTag("div")
		builder.closeTag("div")
		builder.closeTag("div")
	}

	return Result{
		HTML: builder.string(),
		Metadata: Metadata{
			RowCount:    len(data),
			ColumnCount: len(columns),
			Warnings:    warnings,
		},
	}, nil
}

func columnHeader[T any](col Column[T]) string {
	if col.Header != "" {
		return col.Header
	}
	return col.Key
}

func isRightAligned(colType ColumnType) bool {
	return colType == ColumnTypeNumber || colType == ColumnTypeInt || colType == ColumnTypeUint
}

func formatValue[T any](value any, col Column[T]) string {
	if value == nil {
		return ""
	}
	if col.Type == ColumnTypeTags {
		if tags, ok := value.([]string); ok {
			sep := ", "
			if col.Tags != nil && col.Tags.Separator != "" {
				sep = col.Tags.Separator
			}
			return strings.Join(tags, sep)
		}
	}

	switch col.Type {
	case ColumnTypeBoolean:
		return formatBoolean(value, col.Format)
	case ColumnTypeNumber:
		return formatNumber(value, col.Format)
	case ColumnTypeInt, ColumnTypeUint:
		return formatInteger(value)
	case ColumnTypeDate:
		return formatTimeValue(value, defaultDateLayout(col.Format))
	case ColumnTypeTime:
		return formatTimeValue(value, defaultTimeLayout(col.Format))
	case ColumnTypeDateTime:
		return formatTimeValue(value, defaultDateTimeLayout(col.Format))
	case ColumnTypeEnum:
		if col.Enum != nil {
			if s, ok := value.(string); ok {
				if label, found := col.Enum.Labels[s]; found {
					return label
				}
			}
		}
	}
	return fmt.Sprint(value)
}

func formatBoolean(value any, format *Format) string {
	v, ok := value.(bool)
	if !ok {
		return fmt.Sprint(value)
	}
	if format == nil {
		if v {
			return "true"
		}
		return "false"
	}
	trueLabel := format.BooleanTrue
	falseLabel := format.BooleanFalse
	if trueLabel == "" {
		trueLabel = "true"
	}
	if falseLabel == "" {
		falseLabel = "false"
	}
	if v {
		return trueLabel
	}
	return falseLabel
}

func formatNumber(value any, format *Format) string {
	scale := -1
	if format != nil && format.NumberScale != nil {
		scale = *format.NumberScale
	}
	switch v := value.(type) {
	case float32:
		return formatFloat(float64(v), scale)
	case float64:
		return formatFloat(v, scale)
	case int:
		return formatFloat(float64(v), scale)
	case int64:
		return formatFloat(float64(v), scale)
	case uint64:
		return formatFloat(float64(v), scale)
	case uint:
		return formatFloat(float64(v), scale)
	default:
		return fmt.Sprint(value)
	}
}

func formatInteger(value any) string {
	switch v := value.(type) {
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case uint:
		return strconv.FormatUint(uint64(v), 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	default:
		return fmt.Sprint(value)
	}
}

func formatFloat(value float64, scale int) string {
	if scale < 0 {
		return strconv.FormatFloat(value, 'f', -1, 64)
	}
	return strconv.FormatFloat(value, 'f', scale, 64)
}

func formatTimeValue(value any, layout string) string {
	switch v := value.(type) {
	case time.Time:
		return v.Format(layout)
	case *time.Time:
		if v == nil {
			return ""
		}
		return v.Format(layout)
	case string:
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			return t.Format(layout)
		}
		return v
	default:
		return fmt.Sprint(value)
	}
}

func defaultDateLayout(format *Format) string {
	if format != nil && format.DateLayout != "" {
		return format.DateLayout
	}
	return "2006-01-02"
}

func defaultTimeLayout(format *Format) string {
	if format != nil && format.TimeLayout != "" {
		return format.TimeLayout
	}
	return "15:04:05"
}

func defaultDateTimeLayout(format *Format) string {
	if format != nil && format.DateTimeLayout != "" {
		return format.DateTimeLayout
	}
	return "2006-01-02 15:04:05"
}

type fieldGetter struct {
	keyToIndex map[string][]int
	keyNames   map[string]bool
}

func newFieldGetter[T any]() (*fieldGetter, error) {
	var zero T
	typeValue := reflect.TypeOf(zero)
	if typeValue == nil {
		return nil, errors.New("ssr: row type is nil")
	}
	if typeValue.Kind() == reflect.Ptr {
		typeValue = typeValue.Elem()
	}
	if typeValue.Kind() != reflect.Struct {
		return nil, errors.New("ssr: row type must be a struct or pointer to struct")
	}
	keyToIndex := make(map[string][]int)
	keyNames := make(map[string]bool)
	for i := 0; i < typeValue.NumField(); i += 1 {
		field := typeValue.Field(i)
		if field.PkgPath != "" {
			continue
		}
		key := field.Tag.Get("extable")
		if key == "" {
			key = jsonTagKey(field.Tag.Get("json"))
		}
		if key == "" {
			key = field.Name
		}
		if key == "-" {
			continue
		}
		if _, exists := keyToIndex[key]; exists {
			continue
		}
		keyToIndex[key] = field.Index
		keyNames[key] = true
	}
	return &fieldGetter{keyToIndex: keyToIndex, keyNames: keyNames}, nil
}

func (g *fieldGetter) valueForKey(row any, key string) (any, bool) {
	index, ok := g.keyToIndex[key]
	if !ok {
		return nil, false
	}
	value := reflect.ValueOf(row)
	if !value.IsValid() {
		return nil, false
	}
	if value.Kind() == reflect.Ptr {
		if value.IsNil() {
			return nil, false
		}
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return nil, false
	}
	fieldValue := value.FieldByIndex(index)
	if !fieldValue.IsValid() {
		return nil, false
	}
	return fieldValue.Interface(), true
}

func (g *fieldGetter) rowReadonly(row any) bool {
	value, ok := g.valueForKey(row, "_readonly")
	if !ok {
		return false
	}
	readonly, ok := value.(bool)
	return ok && readonly
}

func jsonTagKey(tag string) string {
	if tag == "" {
		return ""
	}
	parts := strings.Split(tag, ",")
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}

func styleString(style map[string]string) string {
	keys := make([]string, 0, len(style))
	for key := range style {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		value := strings.TrimSpace(style[key])
		if value == "" {
			continue
		}
		parts = append(parts, key+": "+value+";")
	}
	return strings.Join(parts, " ")
}
